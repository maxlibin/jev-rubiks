import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Move } from '../cube/types';
import { cubieOfMesh, type CubeMesh, type Cubie } from './cubeMesh';
import { axisVector, directionVector, dragToMove, faceletIndex, snapToDirection, type Direction } from './grid';
import type { Axis } from '../cube/types';

const DRAG_THRESHOLD_PX = 12;
const HINT_ARROW_LENGTH = 0.6;

/** Where the pointer is over a sticker, and the on-screen angles (degrees) of its two drag directions. */
export type HoverHint = {
  readonly facelet: number;
  readonly x: number;
  readonly y: number;
  readonly angles: readonly [number, number];
};

type Pressed = {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly cubie: Cubie;
  readonly normal: Direction;
  readonly pointWorld: Vector3;
  readonly pointLocal: Vector3;
  emitted: boolean;
};

export type DragControlsParams = {
  readonly canvas: HTMLCanvasElement;
  readonly camera: Camera;
  readonly cube: CubeMesh;
  readonly orbit: OrbitControls;
  /** True while an animation runs; drags are ignored (orbit still works). */
  isLocked(): boolean;
  onMove(move: Move): void;
  onHover(hint: HoverHint | null): void;
};

export function createDragControls(params: DragControlsParams): { dispose(): void } {
  const { canvas, camera, cube, orbit } = params;
  const raycaster = new Raycaster();
  let pressed: Pressed | null = null;

  const pointerNdc = (event: PointerEvent): Vector2 => {
    const rect = canvas.getBoundingClientRect();
    return new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (params.isLocked()) return;
    raycaster.setFromCamera(pointerNdc(event), camera);
    const hit = raycaster.intersectObjects(cube.cubies.map((c) => c.mesh), false)[0];
    if (hit === undefined || hit.face === undefined || hit.face === null) return;
    const cubie = cubieOfMesh(cube, hit.object);
    // Cubies sit unrotated under the group, so the face normal is already in cube-local space.
    const normal = snapToDirection(hit.face.normal);
    orbit.enabled = false;
    canvas.setPointerCapture(event.pointerId);
    params.onHover(null);
    pressed = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cubie,
      normal,
      pointWorld: hit.point.clone(),
      pointLocal: cube.group.worldToLocal(hit.point.clone()),
      emitted: false,
    };
  };

  const screenPoint = (world: Vector3): { readonly x: number; readonly y: number } => {
    const rect = canvas.getBoundingClientRect();
    const ndc = world.clone().project(camera);
    return { x: ((ndc.x + 1) / 2) * rect.width, y: ((1 - ndc.y) / 2) * rect.height };
  };

  const hoverHint = (event: PointerEvent): HoverHint | null => {
    raycaster.setFromCamera(pointerNdc(event), camera);
    const hit = raycaster.intersectObjects(cube.cubies.map((c) => c.mesh), false)[0];
    if (hit === undefined || hit.face === undefined || hit.face === null) return null;
    const cubie = cubieOfMesh(cube, hit.object);
    const normal = snapToDirection(hit.face.normal);
    const facelet = faceletIndex(cubie.position, normal);
    if (facelet === null) return null;
    const normalAxis = normal.charAt(1) as Axis;
    const tangents = (['x', 'y', 'z'] as const).filter((axis) => axis !== normalAxis);
    const origin = screenPoint(hit.point);
    const angles = tangents.map((axis) => {
      const tip = hit.point.clone().add(axisVector(axis).applyQuaternion(cube.group.quaternion).multiplyScalar(HINT_ARROW_LENGTH));
      const end = screenPoint(tip);
      return (Math.atan2(end.y - origin.y, end.x - origin.x) * 180) / Math.PI;
    });
    const [a0, a1] = angles;
    if (a0 === undefined || a1 === undefined) return null;
    return { facelet, x: origin.x, y: origin.y, angles: [a0, a1] };
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (pressed === null) {
      params.onHover(params.isLocked() ? null : hoverHint(event));
      return;
    }
    if (pressed.emitted || event.pointerId !== pressed.pointerId) return;
    if (Math.hypot(event.clientX - pressed.startX, event.clientY - pressed.startY) < DRAG_THRESHOLD_PX) return;
    raycaster.setFromCamera(pointerNdc(event), camera);
    const normalWorld = directionVector(pressed.normal).applyQuaternion(cube.group.quaternion);
    const plane = new Plane().setFromNormalAndCoplanarPoint(normalWorld, pressed.pointWorld);
    const target = new Vector3();
    if (raycaster.ray.intersectPlane(plane, target) === null) return;
    const dragLocal = cube.group.worldToLocal(target).sub(pressed.pointLocal);
    pressed.emitted = true;
    const move = dragToMove(pressed.normal, pressed.cubie.position, dragLocal);
    if (move !== null) params.onMove(move);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (pressed === null || event.pointerId !== pressed.pointerId) return;
    canvas.releasePointerCapture(event.pointerId);
    orbit.enabled = true;
    pressed = null;
  };

  // Capture phase so we run before OrbitControls' own pointerdown listener.
  canvas.addEventListener('pointerdown', onPointerDown, { capture: true });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', () => params.onHover(null));

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown, { capture: true });
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
