import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { applyRotation, DEFAULT_ORIENTATION } from '../src/cube/orientation';
import type { Orientation, Rotation } from '../src/cube/types';
import {
  DIRECTIONS,
  dragToMove,
  faceletIndex,
  GRID_POSITIONS,
  layerTurn,
  orientationToQuaternion,
  rotationQuaternion,
  snapToDirection,
} from '../src/scene/grid';

describe('faceletIndex', () => {
  it('maps the URF corner stickers to U9, R1, F3', () => {
    const p = { x: 1, y: 1, z: 1 } as const;
    expect(faceletIndex(p, '+y')).toBe(8);
    expect(faceletIndex(p, '+x')).toBe(9);
    expect(faceletIndex(p, '+z')).toBe(20);
    expect(faceletIndex(p, '-x')).toBeNull();
  });

  it('maps DLF to D1, L9, F7 and ULB to U1, L1, B3', () => {
    expect(faceletIndex({ x: -1, y: -1, z: 1 }, '-y')).toBe(27);
    expect(faceletIndex({ x: -1, y: -1, z: 1 }, '-x')).toBe(44);
    expect(faceletIndex({ x: -1, y: -1, z: 1 }, '+z')).toBe(24);
    expect(faceletIndex({ x: -1, y: 1, z: -1 }, '+y')).toBe(0);
    expect(faceletIndex({ x: -1, y: 1, z: -1 }, '-x')).toBe(36);
    expect(faceletIndex({ x: -1, y: 1, z: -1 }, '-z')).toBe(47);
  });

  it('covers every facelet exactly once', () => {
    const seen = new Set<number>();
    for (const p of GRID_POSITIONS) {
      for (const d of DIRECTIONS) {
        const index = faceletIndex(p, d);
        if (index !== null) {
          expect(seen.has(index)).toBe(false);
          seen.add(index);
        }
      }
    }
    expect(seen.size).toBe(54);
  });
});

describe('layerTurn', () => {
  it('R is -90° about +x on layer +1; D is +90° about +y on layer -1', () => {
    expect(layerTurn({ face: 'R', turns: 1 })).toEqual({ axis: 'x', layer: 1, angle: -Math.PI / 2 });
    expect(layerTurn({ face: 'D', turns: 1 })).toEqual({ axis: 'y', layer: -1, angle: Math.PI / 2 });
    expect(layerTurn({ face: 'U', turns: 3 })).toEqual({ axis: 'y', layer: 1, angle: Math.PI / 2 });
    expect(layerTurn({ face: 'F', turns: 2 })).toEqual({ axis: 'z', layer: 1, angle: -Math.PI });
  });
});

describe('orientationToQuaternion', () => {
  it('is the identity for the default orientation', () => {
    const q = orientationToQuaternion(DEFAULT_ORIENTATION);
    expect(q.angleTo(new Quaternion())).toBeCloseTo(0, 6);
  });

  it('composes: quaternion(apply(o, r)) == rotation(r) * quaternion(o) for all rotations', () => {
    const rotations: Rotation[] = [];
    for (const axis of ['x', 'y', 'z'] as const) {
      for (const turns of [1, 2, 3] as const) rotations.push({ axis, turns });
    }
    let o: Orientation = DEFAULT_ORIENTATION;
    for (const r of [...rotations, ...rotations]) {
      const expected = rotationQuaternion(r).multiply(orientationToQuaternion(o));
      o = applyRotation(o, r);
      expect(orientationToQuaternion(o).angleTo(expected)).toBeCloseTo(0, 6);
    }
  });
});

describe('snapToDirection', () => {
  it('picks the dominant axis', () => {
    expect(snapToDirection(new Vector3(0.1, -0.9, 0.2))).toBe('-y');
    expect(snapToDirection(new Vector3(0.7, 0.7, 0.71))).toBe('+z');
  });
});

describe('dragToMove', () => {
  it('dragging the front top row to the right is U prime', () => {
    expect(dragToMove('+z', { x: 0, y: 1, z: 1 }, new Vector3(0.5, 0.05, 0))).toEqual({ face: 'U', turns: 3 });
  });

  it('dragging the front top row to the left is U', () => {
    expect(dragToMove('+z', { x: 0, y: 1, z: 1 }, new Vector3(-0.5, 0, 0))).toEqual({ face: 'U', turns: 1 });
  });

  it('dragging the front bottom row to the right is D', () => {
    expect(dragToMove('+z', { x: 0, y: -1, z: 1 }, new Vector3(0.5, 0, 0))).toEqual({ face: 'D', turns: 1 });
  });

  it('dragging the right face top row toward the front is U', () => {
    expect(dragToMove('+x', { x: 1, y: 1, z: 0 }, new Vector3(0, 0, 0.5))).toEqual({ face: 'U', turns: 1 });
  });

  it('dragging the front face right column up is R', () => {
    expect(dragToMove('+z', { x: 1, y: 0, z: 1 }, new Vector3(0, 0.5, 0))).toEqual({ face: 'R', turns: 1 });
  });

  it('ignores middle slices and drags along the normal', () => {
    expect(dragToMove('+z', { x: 0, y: 0, z: 1 }, new Vector3(0.5, 0, 0))).toBeNull();
    expect(dragToMove('+z', { x: 0, y: 1, z: 1 }, new Vector3(0, 0, 0.5))).toBeNull();
  });
});
