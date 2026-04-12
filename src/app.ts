import * as LocAR from "locar";
import * as THREE from "three";
import {MindARThree} from "mind-ar/dist/mindar-image-three.prod.js";
import spots from "./spots.json";
import railway from "./generated/railway.json";
import timetable from "./timetable.json";

type KochiTrainLine =
	| "dosansen"
	| "dosansen_susaki"
	| "seto_ohashisen"
	| "tosa_gomensen"
	| "tosa_nakamurasen"
	| "yodosen"
	| "yosansen"
	| "yosansen_uchikosen";
interface Station {
	line: KochiTrainLine;
	station: number;
}
interface Train {
	time: string;
	number: string;
	type: string;
	name: string;
	term: string;
	route: Station[];
}
interface PnTrain {
	line_id: string;
	direction: "inbound" | "outbound";
	train_number: string;
	starting_station: string;
}
interface TimeTable {
	[key: string]: {
		[key: string]: {
			[key: string]: {
				starting_station: string;
				train_type: string;
				previous_trains: PnTrain[];
				next_trains: PnTrain[];
				destination?: string;
				is_temporary_train?: boolean;
				arrival_times?: (string | null)[];
				departure_times?: (string | null)[];
			}[];
		};
	};
}
interface StationNames {
	[key: string]: {[key: number]: string};
}

const files = import.meta.glob("./dynamic/*");
const loadFile = async (path: string) =>
	((await files[path]()) as {default: string}).default;
const createMesh = (
	texture: THREE.Texture,
	width: number,
	height: number,
	mat?: boolean,
) => {
	texture.colorSpace = THREE.SRGBColorSpace;
	return new THREE.Mesh(
		new THREE.PlaneGeometry(width, height),
		mat
			? new THREE.MeshLambertMaterial({
					map: texture,
				})
			: new THREE.MeshBasicMaterial({
					map: texture,
				}),
	);
};
const name = location.search.slice(1);
const locarScene = new THREE.Scene();
locarScene.add(new THREE.AmbientLight(0xffffff, 2.0));
locarScene.add(new THREE.HemisphereLight(0xffffff, 0x000000, 2.0));
const locarCamera = new THREE.PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	1,
	100000,
);
const locar = new LocAR.LocationBased(locarScene, locarCamera);
const deviceOrientationControls = new LocAR.DeviceOrientationControls(
	locarCamera,
);
deviceOrientationControls.on("deviceorientationgranted", e =>
	e.target.connect(),
);
deviceOrientationControls.init();
locar.fakeGps(133.685, 33.607);
locar.startGps();
const elevZoom = 15;
const elevTileSize = 256;
for (const i of spots) {
	const spCanvas = document.createElement("canvas");
	const spCtx = spCanvas.getContext("2d") as CanvasRenderingContext2D;
	spCtx.canvas.width = 2048;
	spCtx.canvas.height = 256;
	spCtx.fillStyle = "#fff";
	spCtx.fillRect(0, 0, spCtx.canvas.width, spCtx.canvas.height);
	spCtx.fillStyle = "#000";
	spCtx.font = "256px sans-serif";
	spCtx.fillText(
		i.name,
		(spCtx.canvas.width - spCtx.measureText(i.name).width) / 2,
		(spCtx.canvas.height + spCtx.measureText(i.name).actualBoundingBoxAscent) /
			2,
	);
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: new THREE.CanvasTexture(spCanvas),
			sizeAttenuation: false,
		}),
	);
	sprite.scale.set(0.5, (spCtx.canvas.height * 0.5) / spCtx.canvas.width, 1);
	const elevCanvas = document.createElement("canvas");
	elevCanvas.width = elevCanvas.height = elevTileSize;
	const elevCtx = elevCanvas.getContext("2d", {
		willReadFrequently: true,
	}) as CanvasRenderingContext2D;
	const elevCoord = [
		(i.lng + 180) / 360,
		1 -
			(Math.log(Math.tan(((Math.PI / 180) * i.lat) / 2 + Math.PI / 4)) /
				Math.PI +
				1) /
				2,
	].map(j => {
		const worldCoord = j * 2 ** elevZoom;
		const tileNum = Math.floor(worldCoord);
		return {
			tile: tileNum,
			pixel: Math.floor(worldCoord * elevTileSize) - tileNum * elevTileSize,
		};
	});
	const elevImg = new Image();
	elevImg.src = `https://cyberjapandata.gsi.go.jp/xyz/dem5a_png/${elevZoom}/${elevCoord[0].tile}/${elevCoord[1].tile}.png`;
	elevImg.setAttribute("crossorigin", "anonymous");
	elevImg.addEventListener("load", () => {
		elevCtx.drawImage(elevImg, 0, 0);
		const {data} = elevCtx.getImageData(0, 0, elevTileSize, elevTileSize);
		const idx = elevCoord[1].pixel * 1024 + elevCoord[0].pixel * 4;
		const x = data[idx] * 65536 + data[idx + 1] * 256 + data[idx + 2];
		locar.add(
			sprite,
			i.lng,
			i.lat,
			x < 8388608 ? x * 0.01 : x > 8388608 ? (x - 16777216) * 0.01 : undefined,
		);
	});
}
const load = async () => {
	const mindarThree = new MindARThree({
		container: document.getElementById("container"),
		imageTargetSrc: await loadFile(`./dynamic/${name}.mind`),
	});
	const {renderer, scene, camera} = mindarThree;
	renderer.autoClearColor = false;
	const update = () => {
		renderer.clear();
		renderer.render(locarScene, locarCamera);
		renderer.clearDepth();
		renderer.render(scene, camera);
		deviceOrientationControls.update();
		requestAnimationFrame(update);
	};
	const start = async () => {
		await mindarThree.start();
		update();
	};
	switch (name) {
		case "tosayamada": {
			const video = document.createElement("video");
			video.src = await loadFile(`./dynamic/${name}.mkv`);
			video.load();
			video.muted = true;
			const anchor = mindarThree.addAnchor(0);
			anchor.onTargetFound = () => video.play();
			anchor.onTargetLost = () => {
				video.pause();
				video.currentTime = 0;
			};
			video.addEventListener("loadedmetadata", () => {
				const mesh = createMesh(
					new THREE.VideoTexture(video),
					1,
					video.videoHeight / video.videoWidth,
				);
				mesh.position.set(0, 65155 / 544768, 0);
				anchor.group.add(mesh);
			});
			start();
			break;
		}
		default: {
			const imageSrc = await loadFile(`./dynamic/${name}.webp`);
			const image = new Image();
			image.addEventListener("load", () => {
				mindarThree
					.addAnchor(0)
					.group.add(
						createMesh(
							new THREE.TextureLoader().load(imageSrc),
							1,
							image.naturalHeight / image.naturalWidth,
						),
					);
				start();
			});
			image.src = imageSrc;
		}
	}
};
const staNameMajor: StationNames = {
	dosansen: {
		0: "高知",
		10: "後免",
		16: "土佐山田",
		36: "大歩危",
		46: "阿波池田",
	},
	dosansen_susaki: {
		0: "窪川",
		14: "須崎",
		44: "朝倉",
		54: "高知",
	},
	seto_ohashisen: {},
	tosa_gomensen: {
		0: "後免",
		28: "安芸",
		40: "奈半利",
	},
	tosa_nakamurasen: {
		0: "宿毛",
		14: "中村",
		44: "窪川",
	},
	yodosen: {
		0: "宇和島",
		99: "窪川",
	},
	yosansen: {},
	yosansen_uchikosen: {},
};
const timeToMinute = (h: number, m: number) => (h < 4 ? h + 24 : h) * 60 + m;
const oldGroups: THREE.Group<THREE.Object3DEventMap>[] = [];
locar.on("gpsupdate", () => {
	const loc = locar.getLastKnownLocation();
	if (loc) {
		const locArray = Object.values(loc);
		const nearby = (
			railway as [
				{
					coords: [[number, number], [number, number]];
					position: {
						line: KochiTrainLine;
						station: number;
					}[];
				},
			]
		).filter(e =>
			e.coords.some(f =>
				[0.003, 0.004].every((g, i) => Math.abs(f[i] - locArray[i]) < g),
			),
		);
		const distance = nearby.map(e => {
			const square = locArray.map(
				(f, i) => ((e.coords[0][i] + e.coords[1][i]) / 2 - f) ** 2,
			);
			return square[0] + square[1];
		});
		const nearest = nearby[distance.indexOf(Math.min(...distance))];
		const pathDelta = nearest.coords[0].map((e, i) => e - nearest.coords[1][i]);
		const relLoc = locArray.map((e, i) => e - nearest.coords[0][i]);
		const pathDist = Math.sqrt(pathDelta[0] ** 2 + pathDelta[1] ** 2);
		const pathDeltaNormal = pathDelta.map(e => (e * 0.0005) / pathDist);
		while (oldGroups.length) {
			locarScene.remove(
				oldGroups.shift() as THREE.Group<THREE.Object3DEventMap>,
			);
		}
		if (
			Math.sign(
				(relLoc[1] - pathDeltaNormal[0]) * pathDelta[0] -
					(relLoc[0] + pathDeltaNormal[1]) * pathDelta[1],
			) !==
			Math.sign(
				(relLoc[1] + pathDeltaNormal[0]) * pathDelta[0] -
					(relLoc[0] - pathDeltaNormal[1]) * pathDelta[1],
			)
		) {
			const trains: [Train[], Train[]] = [[], []];
			const via: {
				line: string;
				name: [[string, string][] | undefined, [string, string][] | undefined];
			}[] = [];
			const now = new Date();
			const isDates = [
				{
					3: [29],
					4: [4, 5, 6],
					5: [],
					6: [20],
					7: [11],
					8: [21, 22, 23],
				},
				{
					3: [10, 24],
					4: [22, 29],
					5: [12, 26],
					6: [31],
					7: [7, 21],
					8: [4],
				},
				{
					3: [17, 29],
					4: [9, 15],
					5: [5, 20],
					6: [18, 24],
					7: [14, 29],
					8: [11, 26],
				},
				{
					3: [],
					4: [],
					5: [],
					6: [],
					7: [10, 12, 13, 14],
					8: [],
				},
			].map(e =>
				e[now.getMonth() as 3 | 4 | 5 | 6 | 7 | 8].includes(now.getDate()),
			);
			for (const i of nearest.position) {
				const majorSta = Object.entries(staNameMajor[i.line]);
				via.push({
					line: i.line,
					name: [
						majorSta.filter(e => Number(e[0]) > i.station).slice(0, 2),
						majorSta
							.filter(e => Number(e[0]) < i.station)
							.toReversed()
							.slice(0, 2),
					],
				});
				Object.values((timetable as TimeTable)[i.line]).forEach((v, k) => {
					for (const j of Object.entries(v)) {
						if (/^回?9\d{3}D$/.test(j[0])) continue;
						if (trains[k].find(e => e.number === j[0])) continue;
						switch (j[0]) {
							case "4214D":
							case "4743D":
							case "4748D":
							case "4749D":
							case "4758D":
							case "5844D":
							case "5849D":
							case "5850D":
								if (isDates[0] || now.getDay() === 0 || now.getDay() === 6)
									continue;
								break;
							case "8073D":
							case "8074D":
								if (
									(!isDates[0] || now.getDay() === 3) &&
									(isDates[2] || now.getDay() !== 6) &&
									isDates[1] &&
									now.getDay()
								)
									continue;
								break;
							case "8082D":
							case "8083D":
								if (!isDates[2]) continue;
								break;
							case "8816D":
							case "8821D":
								if (
									!isDates[3] ||
									(!isDates[0] && now.getDay() !== 0 && now.getDay() !== 6) ||
									now.getMonth() === 6
								)
									continue;
						}
						let train = j[1][0];
						const times = train.departure_times;
						if (!times) continue;
						let station = i.station / 2;
						if (k) station = times.length - station - 1;
						const pIdx = Math.floor(station);
						let pTime = times[pIdx];
						if (pTime === null) {
							if (!pIdx) continue;
							const p = times.slice(0, pIdx - 1).findLast(f => f !== null);
							if (p) pTime = p;
							else continue;
						}
						const nIdx = Math.ceil(station);
						let nTime = times[nIdx];
						if (nTime === null) {
							const n = times.slice(nIdx + 1).find(f => f !== null);
							if (n) nTime = n;
							else continue;
						}
						const timeNum = nTime.slice(-5).split(":").map(Number);
						if (
							timeToMinute(timeNum[0], timeNum[1]) <
							timeToMinute(now.getHours(), now.getMinutes())
						)
							continue;
						let type: string;
						let name = "";
						switch (train.train_type) {
							case "回送":
							case "快速":
							case "普通":
								type = train.train_type;
								break;
							case "夜明け":
								type = "特急";
								switch (j[0]) {
									case "8073D":
										name = "立志";
										break;
									case "8074D":
										name = "開花";
										break;
									case "8082D":
										name = "煌海";
										break;
									case "8083D":
										name = "雄飛";
								}
								break;
							default:
								type = /^(20)?\d\dD$/.test(j[0]) ? "特急" : "普通";
								name = train.train_type;
						}
						let line = i.line;
						const route: Station[] = [];
						while (train.next_trains.length) {
							const lastSta = train.departure_times?.findLastIndex(
								e => e !== null,
							);
							if (lastSta) route.push({line: line, station: lastSta});
							const next = train.next_trains[0];
							const foundTrain = (timetable as TimeTable)[next.line_id][
								next.direction + "_trains"
							][next.train_number].find(
								e => e.starting_station === next.starting_station,
							);
							if (foundTrain) {
								train = foundTrain;
								line = next.line_id as KochiTrainLine;
							} else break;
						}
						const timesLast = train.departure_times;
						let term = "不明";
						if (timesLast) {
							let termPos = timesLast.findLastIndex(f => f !== null);
							route.push({line: line, station: termPos});
							if (k) termPos = timesLast.length - termPos - 1;
							termPos *= 2;
							term = staNameMajor[line][termPos];
							if (!term)
								term = (
									{
										dosansen: {4: "土佐一宮"},
										dosansen_susaki: {40: "伊野"},
										seto_ohashisen: {24: "岡山"},
										tosa_gomensen: {10: "あかおか"},
										tosa_nakamurasen: {},
										yodosen: {12: "近永", 24: "江川崎"},
										yosansen: {112: "高松"},
										yosansen_uchikosen: {0: "宇和島"},
									} as StationNames
								)[line][termPos];
						}
						const match = j[0].match(/^(.+)__T$/);
						trains[k].push({
							time: pTime.slice(-5),
							number: match ? match[1] : j[0],
							type: type,
							name: name,
							term: term,
							route: route,
						});
					}
				});
			}
			trains.forEach((i, idx1) => {
				const group = new THREE.Group();
				group.add(
					new THREE.Mesh(
						new THREE.BoxGeometry(1.7, 0.7, 0.3),
						new THREE.MeshLambertMaterial({color: 0x777777}),
					),
				);
				const titleCanvas = document.createElement("canvas");
				const titleCtx = titleCanvas.getContext(
					"2d",
				) as CanvasRenderingContext2D;
				titleCtx.canvas.width = 704;
				titleCtx.canvas.height = 160;
				titleCtx.fillStyle = "#777";
				titleCtx.fillRect(0, 0, titleCtx.canvas.width, titleCtx.canvas.height);
				titleCtx.fillStyle = "#fff";
				titleCtx.font = "64px sans-serif";
				titleCtx.textAlign = "center";
				titleCtx.textBaseline = "ideographic";
				if (via[0].name[idx1]) {
					let viaAll = via[0].name[idx1]
						.concat(
							via.length - 1 && via[1].name[idx1] ? via[1].name[idx1] : [],
						)
						.map(e => e[1]);
					viaAll = viaAll.filter((_, i) => !(i % (viaAll.length / 2)));
					titleCtx.fillText(
						viaAll.length
							? viaAll[0]
							: staNameMajor[nearest.position[0].line][
									nearest.position[0].station
								],
						64,
						112,
						128,
					);
					if (viaAll.length > 1) {
						titleCtx.fillText("・", 160, 112, 64);
						titleCtx.fillText(viaAll[1], 256, 112, 128);
					}
				}
				titleCtx.font = "48px sans-serif";
				titleCtx.fillText("方面", 376, 112, 96);
				titleCtx.font = "64px sans-serif";
				titleCtx.fillText("発車時刻", 576, 112, 256);
				const title = createMesh(
					new THREE.CanvasTexture(titleCanvas),
					1.056,
					0.24,
					true,
				);
				title.position.y = 0.225;
				title.position.z = -0.15001;
				title.rotation.x = title.rotation.z = Math.PI;
				group.add(title);
				i.sort((a, b) => Number(a.time > b.time) * 2 - 1);
				for (let j = 0; j < 3; j++) {
					const canvas = document.createElement("canvas");
					const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
					ctx.canvas.width = 1024;
					ctx.canvas.height = 64;
					if (j < i.length) {
						const train = i[j];
						ctx.font = "64px monospace";
						ctx.fillStyle = "#fff";
						ctx.textAlign = "right";
						ctx.fillText(train.number, 160, 56, 160);
						let typeColor = "";
						switch (train.type) {
							case "回送":
								typeColor = "#0f7";
								break;
							case "快速":
								typeColor = "#0ef";
								break;
							case "特急":
								typeColor = "#f00";
						}
						ctx.fillStyle = typeColor;
						if (typeColor.length) ctx.fillRect(176, 0, 128, 64);
						ctx.fillStyle = "#fff";
						ctx.font = "64px sans-serif";
						ctx.textAlign = "center";
						ctx.textBaseline = "ideographic";
						ctx.fillText(train.type, 240, 64, 128);
						ctx.fillStyle = typeColor;
						let gou = "";
						if (/^88\d\dD$/.test(train.number)) {
							ctx.font = "32px sans-serif";
							ctx.textAlign = "left";
							ctx.fillText("しまん", 320, 32, 128);
							ctx.fillText("トロッコ", 320, 64, 128);
							switch (train.number) {
								case "8816D":
									gou = "2";
									break;
								case "8821D":
									gou = "1";
							}
						} else {
							const match = train.name.match(/^(.+?)(\d+)号$/);
							if (match) {
								ctx.fillText(match[1], 384, 64, 128);
								gou = match[2];
							}
						}
						ctx.lineWidth = 4;
						if (gou) {
							ctx.font = "64px monospace";
							ctx.textAlign = "right";
							ctx.textBaseline = "alphabetic";
							ctx.fillText(gou, 512, 56, 64);
							ctx.font = "64px sans-serif";
							ctx.textAlign = "left";
							ctx.textBaseline = "ideographic";
							ctx.fillText("号", 512, 64, 64);
						} else {
							if (
								/^58\d\dD$/.test(train.number) &&
								train.route[0].line === "dosansen"
							) {
								ctx.strokeStyle = "#fff";
								ctx.strokeRect(320, 0, 256, 64);
								ctx.font = "48px sans-serif";
								ctx.fillText("ごめん・なはり線", 448, 56, 240);
							} else if (train.type === "特急") {
								ctx.font = "32px sans-serif";
								ctx.fillText("志国土佐 時代の", 400, 32, 160);
								ctx.fillText("夜明けのものがたり", 400, 64, 160);
								ctx.font = "48px sans-serif";
								ctx.fillText(train.name + "の抄", 528, 56, 96);
							} else {
								const dirSta = via.find(e => e.line === train.route[0].line)
									?.name[idx1];
								if (dirSta?.length) {
									ctx.fillText(dirSta[0][1], 384, 64, 128);
									ctx.font = "48px sans-serif";
									ctx.fillText("方面", 480, 64, 64);
								}
								if (/^[34]\d{3}D$/.test(train.number)) {
									ctx.font = "32px sans-serif";
									ctx.fillRect(512, 0, 64, 64);
									ctx.fillStyle = "#000";
									if (train.number[0] === "3") {
										ctx.fillText("2両", 544, 32, 64);
										ctx.fillText("ワンマン", 544, 64, 64);
									} else {
										ctx.fillText("ワン", 544, 32, 64);
										ctx.fillText("マン", 544, 64, 64);
									}
								}
							}
						}
						ctx.fillStyle = "#fff";
						ctx.font = "64px monospace";
						ctx.textAlign = "center";
						ctx.textBaseline = "alphabetic";
						ctx.fillText(train.time, 672, 56, 160);
						ctx.fillStyle = "#ff0";
						ctx.textBaseline = "ideographic";
						let notLast = false;
						const term = train.route.at(-1);
						if (term)
							for (const k of i
								.slice(j + 1)
								.filter(e => e.type === train.type)) {
								const sta = k.route.find(g => term.line === g.line);
								if (sta && term.station <= sta.station) {
									notLast = true;
									break;
								}
							}
						if (notLast) {
							ctx.font = "64px sans-serif";
							ctx.fillText(train.term, 896, 64, 256);
						} else {
							ctx.strokeStyle = "#ff0";
							ctx.strokeRect(768, 0, 256, 64);
							ctx.font = "48px sans-serif";
							ctx.fillText(train.term, 896, 56, 240);
						}
					}
					const mesh = createMesh(
						new THREE.CanvasTexture(canvas),
						1.55,
						0.096875,
					);
					mesh.position.y = 0.055 - j * 0.14;
					mesh.position.z = -0.15001;
					mesh.rotation.x = mesh.rotation.z = Math.PI;
					group.add(mesh);
				}
				const dir = idx1 * 2 - 1;
				group.rotation.y =
					Math.atan2(pathDelta[0], pathDelta[1]) + (Math.PI / 2) * dir;
				oldGroups.push(group);
				locar.add(
					group,
					loc.longitude + (pathDeltaNormal[1] / 15) * dir,
					loc.latitude + (pathDeltaNormal[0] / 15) * dir,
					1,
				);
			});
		}
	}
});
load();
let mousedown = false,
	lastX = -1;
window.addEventListener("mousedown", () => {
	mousedown = true;
});
window.addEventListener("mouseup", () => {
	mousedown = false;
});
window.addEventListener("mousemove", e => {
	if (mousedown) {
		if (lastX >= 0) locarCamera.rotation.y += (e.clientX - lastX) / 1000;
		lastX = e.clientX;
	} else {
		lastX = -1;
	}
});
