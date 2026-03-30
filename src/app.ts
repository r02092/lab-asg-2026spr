import * as LocAR from "locar";
import * as THREE from "three";
import {MindARThree} from "mind-ar/dist/mindar-image-three.prod.js";
import spots from "./spots.json";

const files = import.meta.glob("./dynamic/*");
const loadFile = async (path: string) =>
	((await files[path]()) as {default: string}).default;
const createMesh = (texture: THREE.Texture, size: number) => {
	texture.colorSpace = THREE.SRGBColorSpace;
	return new THREE.Mesh(
		new THREE.PlaneGeometry(1, size),
		new THREE.MeshBasicMaterial({
			map: texture,
		}),
	);
};
const name = location.search.slice(1);
const locarScene = new THREE.Scene();
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
							image.naturalHeight / image.naturalWidth,
						),
					);
				start();
			});
			image.src = imageSrc;
		}
	}
};
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
