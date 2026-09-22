import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type RendererApi = {
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly orbit: OrbitControls;
  start(onFrame: (nowMs: number) => void): void;
  resetCamera(): void;
};

const CAMERA_HOME = { x: 4.5, y: 4, z: 6 } as const;

export function createRenderer(container: HTMLElement): RendererApi {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x111318);

  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.minDistance = 4;
  orbit.maxDistance = 15;

  const resetCamera = (): void => {
    camera.position.set(CAMERA_HOME.x, CAMERA_HOME.y, CAMERA_HOME.z);
    orbit.target.set(0, 0, 0);
    orbit.update();
  };
  resetCamera();

  scene.add(new AmbientLight(0xffffff, 1.2));
  const key = new DirectionalLight(0xffffff, 1.8);
  key.position.set(5, 8, 6);
  scene.add(key);
  const fill = new DirectionalLight(0xffffff, 0.6);
  fill.position.set(-6, -3, -4);
  scene.add(fill);

  const resize = (): void => {
    const { clientWidth, clientHeight } = container;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    canvas: renderer.domElement,
    scene,
    camera,
    orbit,
    start(onFrame) {
      renderer.setAnimationLoop((nowMs) => {
        onFrame(nowMs);
        orbit.update();
        renderer.render(scene, camera);
      });
    },
    resetCamera,
  };
}
