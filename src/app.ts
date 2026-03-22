import * as THREE from "three";
import {MindARThree} from "mind-ar/dist/mindar-image-three.prod.js";

const files = import.meta.glob("./dynamic/*");
const loadFile = async (path: string) => {
	return ((await files[path]()) as {default: string}).default;
};
const load = async () => {
	const name = location.search.slice(1);
	const imageTargetSrc = await loadFile(`./dynamic/${name}.mind`);
	const imageSrc = await loadFile(`./dynamic/${name}.png`);
	const mindarThree = new MindARThree({
		container: document.getElementById("container"),
		imageTargetSrc: imageTargetSrc,
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
	const image = new Image();
	const texture = new THREE.TextureLoader().load(imageSrc);
	texture.colorSpace = THREE.SRGBColorSpace;
	image.addEventListener("load", () => {
		mindarThree.addAnchor(0).group.add(
			new THREE.Mesh(
				new THREE.PlaneGeometry(1, image.naturalHeight / image.naturalWidth),
				new THREE.MeshBasicMaterial({
					map: texture,
				}),
			),
		);
		start();
	});
	image.src = imageSrc;
};
load();
