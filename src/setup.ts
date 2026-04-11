import JSZip from "jszip";
import fs from "fs";

type Coord = [number, number];
interface Line {
	type: "Feature";
	properties: {
		N02_001: string;
		N02_002: string;
		N02_003: string;
		N02_004: string;
	};
	geometry: {
		type: "LineString";
		coordinates: Coord[];
	};
}
interface Branch {
	coord: Coord;
	prev: Coord[];
}

const allLine: Line[] = JSON.parse(
	(await (
		await JSZip.loadAsync(
			await (
				await fetch(
					"https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-22/N02-22_GML.zip",
				)
			).arrayBuffer(),
		)
	)
		.file("UTF-8/N02-22_RailroadSection.geojson")
		?.async("string")) as string,
).features;
const equalCoord = (coord1: Coord, coord2: Coord) =>
	coord1.every((e, i) => e === coord2[i]);
const findByCoord = (line: Line[], coord: Coord, exclude: Coord[]) => {
	return line.filter(
		e =>
			!exclude.some(f => equalCoord(e.geometry.coordinates[1], f)) &&
			(equalCoord(e.geometry.coordinates[0], coord) ||
				equalCoord(e.geometry.coordinates.at(-1) as Coord, coord)),
	);
};
const output = [];
const position = [{line: "tosa_nakamurasen", station: 0}];
let nextCoord: Coord = [132.7132, 32.93251];
let prev: Coord[] = [];
const branchStack: Branch[] = [];
let link: boolean = false;
while (position[0].line !== "yodosen" || position[0].station) {
	let paths = findByCoord(allLine, nextCoord, prev);
	switch (position[0].line) {
		case "tosa_nakamurasen":
			if (position[0].station > 43)
				position.push({line: "dosansen_susaki", station: 0});
			if (paths.length - 1) {
				const isBranch =
					!branchStack.length &&
					paths.some(e => e.properties.N02_003 === "予土線");
				paths = paths.filter(e => e.properties.N02_003 === "中村線");
				if (isBranch) {
					branchStack.push({
						coord: nextCoord,
						prev: [...prev, paths[0].geometry.coordinates[1]],
					});
				}
			}
			break;
		case "dosansen_susaki":
			if (position[0].station > 53)
				position.push({line: "dosansen", station: 0});
			if (paths.length - 1)
				paths = paths.filter(e => e.properties.N02_003 === "土讃線");
			break;
		case "dosansen":
			if (paths.length === 2) {
				link = equalCoord(
					paths[0].geometry.coordinates[1],
					paths[1].geometry.coordinates[1],
				);
				if (link && position.length === 1)
					position.push({line: "tosa_gomensen", station: 0});
				paths = paths.filter(e => e.properties.N02_003 === "土讃線");
				if (!link) {
					if (position.length - 1) position.pop();
					position[0].station--;
					if (paths.length - 1)
						paths = paths.filter(e =>
							equalCoord(e.geometry.coordinates[0], [133.69566, 33.64934]),
						);
					branchStack.push({
						coord: nextCoord,
						prev: [...prev, paths[0].geometry.coordinates[1]],
					});
				}
			}
	}
	if (
		!paths.length ||
		(position[0].line === "dosansen" && position[0].station > 35)
	) {
		const branch = branchStack.pop() as Branch;
		prev = branch.prev;
		nextCoord = branch.coord;
		if (paths.length) {
			position[0] = {line: "tosa_gomensen", station: 1};
			paths = [];
		} else if (position[0].line === "tosa_gomensen") {
			position[0] = {line: "yodosen", station: 37};
			paths = [];
		}
	}
	if (paths.length === 1) {
		let coords = paths[0].geometry.coordinates;
		prev = [coords[1]];
		if (!equalCoord(coords[0], nextCoord)) coords = coords.toReversed();
		for (let i = 0; i < coords.length - 1; i++) {
			output.push({
				coords: [coords[i], coords[i + 1]].map(e => e.toReversed()),
				position: structuredClone(position),
			});
		}
		if (!link && position.length - 1) position.shift();
		position[0].station -= position[0].line !== "yodosen" ? -1 : 1;
		if (link) position[1].station++;
		nextCoord = coords.at(-1) as Coord;
	}
}
if (!fs.existsSync("src/generated")) fs.mkdirSync("src/generated");
fs.writeFile("src/generated/railway.json", JSON.stringify(output), () => {});
