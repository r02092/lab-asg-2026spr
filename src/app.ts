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
locar.fakeGps(133.685, 33.607);
for (const i of spots) {
	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
	ctx.canvas.width = 2048;
	ctx.canvas.height = 256;
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	ctx.fillStyle = "#000";
	ctx.font = "256px sans-serif";
	ctx.fillText(
		i.name,
		(ctx.canvas.width - ctx.measureText(i.name).width) / 2,
		(ctx.canvas.height + ctx.measureText(i.name).actualBoundingBoxAscent) / 2,
	);
	const sprite = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: new THREE.CanvasTexture(canvas),
			sizeAttenuation: false,
		}),
	);
	sprite.scale.set(0.5, (ctx.canvas.height * 0.5) / ctx.canvas.width, 1);
	locar.add(sprite, i.lng, i.lat);
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
