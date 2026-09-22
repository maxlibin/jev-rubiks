import { describe, expect, it } from 'vitest';
import { randomScramble, seededRng } from '../../src/cube/scramble';
import { applyMoves, isSolved, solvedState } from '../../src/cube/state';
import type { CubeState } from '../../src/cube/types';
import { solveWhiteCorners, whiteCornersDone } from '../../src/solver/beginner/corners';
import { solveWhiteCross, whiteCrossDone } from '../../src/solver/beginner/cross';
import {
  solveYellowCorners,
  solveYellowCross,
  solveYellowEdges,
  solveYellowFace,
  yellowCornersDone,
  yellowCrossDone,
  yellowFaceDone,
} from '../../src/solver/beginner/lastLayer';
import { middleEdgesDone, solveMiddleEdges } from '../../src/solver/beginner/middle';

export function scrambles(count: number, seed: number): CubeState[] {
  const rng = seededRng(seed);
  return Array.from({ length: count }, () => applyMoves(solvedState(), randomScramble(25, rng)));
}

describe('white cross', () => {
  it('places all four white edges on 100 scrambles and replays cleanly', () => {
    for (const start of scrambles(100, 11)) {
      const result = solveWhiteCross(start);
      expect(whiteCrossDone(result.state)).toBe(true);
      const replayed = applyMoves(start, result.steps.flatMap((step) => step.moves));
      expect(replayed).toEqual(result.state);
      for (const step of result.steps) {
        expect(step.stage).toBe('white_cross');
        expect(step.moves.length).toBeGreaterThan(0);
      }
    }
  });

  it('emits no steps when the cross is already solved', () => {
    expect(solveWhiteCross(solvedState()).steps).toEqual([]);
  });
});

describe('white corners', () => {
  it('completes the first layer on 100 scrambles without breaking the cross', () => {
    for (const start of scrambles(100, 12)) {
      const cross = solveWhiteCross(start);
      const result = solveWhiteCorners(cross.state);
      expect(whiteCrossDone(result.state)).toBe(true);
      expect(whiteCornersDone(result.state)).toBe(true);
      expect(applyMoves(cross.state, result.steps.flatMap((s) => s.moves))).toEqual(result.state);
    }
  });
});

describe('middle edges', () => {
  it('completes two layers on 100 scrambles', () => {
    for (const start of scrambles(100, 13)) {
      const twoLayersStart = solveWhiteCorners(solveWhiteCross(start).state).state;
      const result = solveMiddleEdges(twoLayersStart);
      expect(whiteCornersDone(result.state)).toBe(true);
      expect(whiteCrossDone(result.state)).toBe(true);
      expect(middleEdgesDone(result.state)).toBe(true);
      expect(applyMoves(twoLayersStart, result.steps.flatMap((s) => s.moves))).toEqual(result.state);
    }
  });
});

describe('last layer', () => {
  it('walks every scramble through cross → face → corners → edges to solved', () => {
    for (const start of scrambles(100, 14)) {
      const f2l = solveMiddleEdges(solveWhiteCorners(solveWhiteCross(start).state).state).state;
      const cross = solveYellowCross(f2l);
      expect(yellowCrossDone(cross.state)).toBe(true);
      const face = solveYellowFace(cross.state);
      expect(yellowFaceDone(face.state)).toBe(true);
      const corners = solveYellowCorners(face.state);
      expect(yellowCornersDone(corners.state)).toBe(true);
      const edges = solveYellowEdges(corners.state);
      expect(isSolved(edges.state)).toBe(true);
      expect(middleEdgesDone(edges.state)).toBe(true);
      const all = [...cross.steps, ...face.steps, ...corners.steps, ...edges.steps].flatMap((s) => s.moves);
      expect(applyMoves(f2l, all)).toEqual(edges.state);
    }
  });
});
