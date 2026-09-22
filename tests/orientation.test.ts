import { describe, expect, it } from 'vitest';
import {
  applyRotation,
  applyRotations,
  DEFAULT_ORIENTATION,
  resolveFace,
  rotationsToBringFront,
  viewColors,
} from '../src/cube/orientation';

describe('orientation', () => {
  it('resolves view sides in the default orientation', () => {
    expect(resolveFace(DEFAULT_ORIENTATION, 'facing_you')).toBe('F');
    expect(resolveFace(DEFAULT_ORIENTATION, 'top')).toBe('U');
    expect(resolveFace(DEFAULT_ORIENTATION, 'right')).toBe('R');
    expect(resolveFace(DEFAULT_ORIENTATION, 'left')).toBe('L');
    expect(resolveFace(DEFAULT_ORIENTATION, 'bottom')).toBe('D');
    expect(resolveFace(DEFAULT_ORIENTATION, 'back')).toBe('B');
  });

  it('x brings the front face to the top', () => {
    const o = applyRotation(DEFAULT_ORIENTATION, { axis: 'x', turns: 1 });
    expect(o).toEqual({ up: 'F', front: 'D', right: 'R' });
  });

  it('y brings the right face to the front', () => {
    const o = applyRotation(DEFAULT_ORIENTATION, { axis: 'y', turns: 1 });
    expect(o).toEqual({ up: 'U', front: 'R', right: 'B' });
  });

  it('z brings the top face to the right', () => {
    const o = applyRotation(DEFAULT_ORIENTATION, { axis: 'z', turns: 1 });
    expect(o).toEqual({ up: 'L', front: 'F', right: 'U' });
  });

  it('four quarter turns on any axis return to the start', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      const o = applyRotations(DEFAULT_ORIENTATION, [
        { axis, turns: 1 },
        { axis, turns: 1 },
        { axis, turns: 2 },
      ]);
      expect(o).toEqual(DEFAULT_ORIENTATION);
    }
  });

  it('reports the colour at each view side', () => {
    expect(viewColors(DEFAULT_ORIENTATION)).toEqual({
      facing_you: 'green',
      top: 'yellow',
      right: 'orange',
      left: 'red',
      bottom: 'white',
      back: 'blue',
    });
  });

  it('finds the rotation that brings a face to the front', () => {
    for (const face of ['U', 'D', 'L', 'R', 'B', 'F'] as const) {
      const rotations = rotationsToBringFront(DEFAULT_ORIENTATION, face);
      expect(applyRotations(DEFAULT_ORIENTATION, rotations).front).toBe(face);
    }
    expect(rotationsToBringFront(DEFAULT_ORIENTATION, 'F')).toEqual([]);
  });
});
