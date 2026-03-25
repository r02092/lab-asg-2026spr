import * as THREE from "three";
import {MindARThree} from "mind-ar/dist/mindar-image-three.prod.js";

const files = import.meta.glob("./dynamic/*");
const loadFile = async (path: string) => {
	return ((await files[path]()) as {default: string}).default;
};
const load = async () => {
	const name = location.search.slice(1);
	const mindarThree = new MindARThree({
		container: document.getElementById("container"),
		imageTargetSrc: await loadFile(`./dynamic/${name}.mind`),
	});
	const {renderer, scene, camera} = mindarThree;
	const update = () => {
		renderer.render(scene, camera);
		requestAnimationFrame(update);
	};
	const start = async () => {
		await mindarThree.start();
		update();
	};
	const createMesh = (texture: THREE.Texture, size: number) => {
		texture.colorSpace = THREE.SRGBColorSpace;
		return new THREE.Mesh(
			new THREE.PlaneGeometry(1, size),
			new THREE.MeshBasicMaterial({
				map: texture,
			}),
		);
	};
	switch (name) {
		case "tosayamada": {
			const video = document.createElement("video");
			video.src = await loadFile(`./dynamic/${name}.mp4`);
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
			const imageSrc = await loadFile(`./dynamic/${name}.png`);
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
