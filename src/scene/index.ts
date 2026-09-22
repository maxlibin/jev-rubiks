import { solvedState } from '../cube/state';
import type { Move } from '../cube/types';
import { Vector3 } from 'three';
import { createCubeMesh, highlightFacelets, setHoveredFacelet, syncFromState } from './cubeMesh';
import { directionVector } from './grid';
import { createDragControls } from './dragControls';
import { createDragHint } from './dragHint';
import { createRenderer } from './renderer';
import { createTurnAnimator, type AnimationItem } from './turnAnimator';

export type ScreenPoint = { readonly x: number; readonly y: number };

export type SceneApi = {
  enqueue(item: AnimationItem): void;
  /** Screen position (CSS px, relative to the canvas) of a facelet's sticker centre. */
  projectFacelet(facelet: number): ScreenPoint;
  isBusy(): boolean;
  onIdle(callback: () => void): void;
  highlightFacelets(facelets: readonly number[]): void;
  resetCamera(): void;
};

export type SceneHandlers = {
  onUserMove(move: Move): void;
};

export function createScene(container: HTMLElement, handlers: SceneHandlers): SceneApi {
  const renderer = createRenderer(container);
  const cube = createCubeMesh();
  syncFromState(cube, solvedState());
  renderer.scene.add(cube.group);
  const animator = createTurnAnimator(cube);
  const dragHint = createDragHint(container);
  createDragControls({
    canvas: renderer.canvas,
    camera: renderer.camera,
    cube,
    orbit: renderer.orbit,
    isLocked: () => animator.isBusy(),
    onMove: handlers.onUserMove,
    onHover: (hint) => {
      setHoveredFacelet(cube, hint === null ? null : hint.facelet);
      dragHint.update(hint);
      renderer.canvas.style.cursor = hint === null ? 'grab' : 'pointer';
    },
  });
  renderer.start((nowMs) => animator.tick(nowMs));
  const projectFacelet = (facelet: number): ScreenPoint => {
    for (const cubie of cube.cubies) {
      const sticker = cubie.stickers.find((candidate) => candidate.facelet === facelet);
      if (sticker === undefined) continue;
      const local = new Vector3(cubie.position.x, cubie.position.y, cubie.position.z).add(directionVector(sticker.direction).multiplyScalar(0.5));
      // Called outside the render loop, so refresh the matrices the projection depends on.
      cube.group.updateMatrixWorld(true);
      renderer.camera.updateMatrixWorld(true);
      renderer.camera.matrixWorldInverse.copy(renderer.camera.matrixWorld).invert();
      const ndc = cube.group.localToWorld(local).project(renderer.camera);
      const rect = renderer.canvas.getBoundingClientRect();
      return { x: ((ndc.x + 1) / 2) * rect.width, y: ((1 - ndc.y) / 2) * rect.height };
    }
    throw new RangeError(`No sticker for facelet ${facelet}`);
  };

  return {
    enqueue: (item) => animator.enqueue(item),
    projectFacelet,
    isBusy: () => animator.isBusy(),
    onIdle: (callback) => animator.onIdle(callback),
    highlightFacelets: (facelets) => highlightFacelets(cube, facelets),
    resetCamera: () => renderer.resetCamera(),
  };
}
