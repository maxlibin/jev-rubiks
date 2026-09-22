import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Axis, Face, Move, Orientation, Rotation, Turns } from '../cube/types';

/** Sticker directions in BoxGeometry material-group order. */
export const DIRECTIONS = ['+x', '-x', '+y', '-y', '+z', '-z'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type GridCoordinate = -1 | 0 | 1;
export type GridPosition = { readonly x: GridCoordinate; readonly y: GridCoordinate; readonly z: GridCoordinate };

const COORDS: readonly GridCoordinate[] = [-1, 0, 1];

export const GRID_POSITIONS: readonly GridPosition[] = COORDS.flatMap((x) =>
  COORDS.flatMap((y) => COORDS.map((z): GridPosition => ({ x, y, z }))),
);

const DIRECTION_FACE: Readonly<Record<Direction, Face>> = {
  '+y': 'U',
  '-y': 'D',
  '+z': 'F',
  '-z': 'B',
  '+x': 'R',
  '-x': 'L',
};

const FACE_AXIS: Readonly<Record<Face, { readonly axis: Axis; readonly layer: 1 | -1 }>> = {
  U: { axis: 'y', layer: 1 },
  D: { axis: 'y', layer: -1 },
  R: { axis: 'x', layer: 1 },
  L: { axis: 'x', layer: -1 },
  F: { axis: 'z', layer: 1 },
  B: { axis: 'z', layer: -1 },
};

function directionAxis(d: Direction): Axis {
  return d.charAt(1) as Axis;
}

function directionSign(d: Direction): 1 | -1 {
  return d.charAt(0) === '+' ? 1 : -1;
}

export function axisVector(axis: Axis): Vector3 {
  const v = new Vector3();
  v[axis] = 1;
  return v;
}

export function directionVector(d: Direction): Vector3 {
  return axisVector(directionAxis(d)).multiplyScalar(directionSign(d));
}

export function snapToDirection(v: Vector3): Direction {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  if (ax >= ay && ax >= az) return v.x >= 0 ? '+x' : '-x';
  if (ay >= az) return v.y >= 0 ? '+y' : '-y';
  return v.z >= 0 ? '+z' : '-z';
}

/** Kociemba facelet index of the sticker on cubie `p` facing `d`, or null if that side faces inward. */
export function faceletIndex(p: GridPosition, d: Direction): number | null {
  switch (d) {
    case '+y':
      return p.y === 1 ? (p.z + 1) * 3 + (p.x + 1) : null;
    case '-y':
      return p.y === -1 ? 27 + (1 - p.z) * 3 + (p.x + 1) : null;
    case '+z':
      return p.z === 1 ? 18 + (1 - p.y) * 3 + (p.x + 1) : null;
    case '-z':
      return p.z === -1 ? 45 + (1 - p.y) * 3 + (1 - p.x) : null;
    case '+x':
      return p.x === 1 ? 9 + (1 - p.y) * 3 + (1 - p.z) : null;
    case '-x':
      return p.x === -1 ? 36 + (1 - p.y) * 3 + (p.z + 1) : null;
  }
}

function signedQuarterTurns(turns: Turns): number {
  return turns === 3 ? -1 : turns;
}

export type LayerTurn = { readonly axis: Axis; readonly layer: GridCoordinate; readonly angle: number };

/** The physical rotation (about the cube's local axis) that animates a face move. */
export function layerTurn(move: Move): LayerTurn {
  const { axis, layer } = FACE_AXIS[move.face];
  return { axis, layer, angle: -layer * signedQuarterTurns(move.turns) * (Math.PI / 2) };
}

/** World-axis quaternion for a whole-cube rotation (x like R, y like U, z like F). */
export function rotationQuaternion(rotation: Rotation): Quaternion {
  return new Quaternion().setFromAxisAngle(axisVector(rotation.axis), -signedQuarterTurns(rotation.turns) * (Math.PI / 2));
}

function faceDirectionVector(face: Face): Vector3 {
  const { axis, layer } = FACE_AXIS[face];
  return axisVector(axis).multiplyScalar(layer);
}

/** Quaternion that maps the cube's local face directions onto the world view positions. */
export function orientationToQuaternion(o: Orientation): Quaternion {
  const localToWorld = new Matrix4()
    .makeBasis(faceDirectionVector(o.right), faceDirectionVector(o.up), faceDirectionVector(o.front))
    .transpose();
  return new Quaternion().setFromRotationMatrix(localToWorld);
}

const POSITIVE_FACE: Readonly<Record<Axis, Face>> = { x: 'R', y: 'U', z: 'F' };
const NEGATIVE_FACE: Readonly<Record<Axis, Face>> = { x: 'L', y: 'D', z: 'B' };
const DRAG_EPSILON = 1e-3;

/**
 * Converts a drag on a sticker into the face move it means. `normal` is the
 * sticker's outward direction, `position` its cubie, `drag` the pointer
 * displacement in cube-local space. Returns null for a middle slice or when
 * the drag has no tangential component.
 */
export function dragToMove(normal: Direction, position: GridPosition, drag: Vector3): Move | null {
  const n = directionAxis(normal);
  const tangents = (['x', 'y', 'z'] as const).filter((axis) => axis !== n);
  const [a0, a1] = tangents;
  if (a0 === undefined || a1 === undefined) {
    throw new Error(`Unexpected normal axis ${n}`);
  }
  const dragAxis = Math.abs(drag[a0]) >= Math.abs(drag[a1]) ? a0 : a1;
  const component = drag[dragAxis];
  if (Math.abs(component) < DRAG_EPSILON) return null;
  const a = axisVector(dragAxis).multiplyScalar(Math.sign(component));
  const r = directionVector(normal).cross(a);
  const rotationAxis = snapToDirection(r);
  const axis = directionAxis(rotationAxis);
  const rotationSign = directionSign(rotationAxis);
  const layer = position[axis];
  if (layer === 0) return null;
  const face = layer > 0 ? POSITIVE_FACE[axis] : NEGATIVE_FACE[axis];
  const turns: Turns = rotationSign * layer > 0 ? 3 : 1;
  return { face, turns };
}

export function faceOfDirection(d: Direction): Face {
  return DIRECTION_FACE[d];
}
