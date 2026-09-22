import { FACE_COLOR, OPPOSITE, type Color, type Face, type Orientation, type Rotation } from './types';

export const DEFAULT_ORIENTATION: Orientation = { up: 'U', front: 'F', right: 'R' };

export const VIEW_SIDES = ['facing_you', 'top', 'right', 'left', 'bottom', 'back'] as const;
export type ViewSide = (typeof VIEW_SIDES)[number];

export function resolveFace(orientation: Orientation, side: ViewSide): Face {
  switch (side) {
    case 'facing_you':
      return orientation.front;
    case 'top':
      return orientation.up;
    case 'right':
      return orientation.right;
    case 'left':
      return OPPOSITE[orientation.right];
    case 'bottom':
      return OPPOSITE[orientation.up];
    case 'back':
      return OPPOSITE[orientation.front];
  }
}

/** One clockwise quarter rotation about a world axis: x like R, y like U, z like F. */
function quarterRotation(o: Orientation, axis: Rotation['axis']): Orientation {
  switch (axis) {
    case 'x':
      return { up: o.front, front: OPPOSITE[o.up], right: o.right };
    case 'y':
      return { up: o.up, front: o.right, right: OPPOSITE[o.front] };
    case 'z':
      return { up: OPPOSITE[o.right], front: o.front, right: o.up };
  }
}

export function applyRotation(orientation: Orientation, rotation: Rotation): Orientation {
  let next = orientation;
  for (let i = 0; i < rotation.turns; i += 1) {
    next = quarterRotation(next, rotation.axis);
  }
  return next;
}

export function applyRotations(orientation: Orientation, rotations: readonly Rotation[]): Orientation {
  return rotations.reduce(applyRotation, orientation);
}

export function viewColors(orientation: Orientation): Readonly<Record<ViewSide, Color>> {
  return {
    facing_you: FACE_COLOR[resolveFace(orientation, 'facing_you')],
    top: FACE_COLOR[resolveFace(orientation, 'top')],
    right: FACE_COLOR[resolveFace(orientation, 'right')],
    left: FACE_COLOR[resolveFace(orientation, 'left')],
    bottom: FACE_COLOR[resolveFace(orientation, 'bottom')],
    back: FACE_COLOR[resolveFace(orientation, 'back')],
  };
}

/** The rotations (zero or one) that put `face` at the front; empty when it already is. */
export function rotationsToBringFront(orientation: Orientation, face: Face): readonly Rotation[] {
  const side = VIEW_SIDES.find((candidate) => resolveFace(orientation, candidate) === face);
  if (side === undefined) {
    throw new Error(`Face ${face} is not at any view side of ${JSON.stringify(orientation)}`);
  }
  switch (side) {
    case 'facing_you':
      return [];
    case 'right':
      return [{ axis: 'y', turns: 1 }];
    case 'left':
      return [{ axis: 'y', turns: 3 }];
    case 'back':
      return [{ axis: 'y', turns: 2 }];
    case 'top':
      return [{ axis: 'x', turns: 3 }];
    case 'bottom':
      return [{ axis: 'x', turns: 1 }];
  }
}
