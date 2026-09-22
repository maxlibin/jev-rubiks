import { describe, expect, it } from 'vitest';
import { formatNotation } from '../src/cube/notation';
import { randomScramble, seededRng } from '../src/cube/scramble';
import { applyMoves, isSolved, solvedState, toFaceletString } from '../src/cube/state';
import { cubejsStateAfter, kociembaDistanceSync, solveKociembaSync } from '../src/solver/kociemba';

describe('our permutation tables agree with cubejs', () => {
  it('matches on 100 random 20-move sequences', () => {
    const rng = seededRng(2026);
    for (let i = 0; i < 100; i += 1) {
      const moves = randomScramble(20, rng);
      const ours = toFaceletString(applyMoves(solvedState(), moves));
      expect(ours, formatNotation(moves)).toBe(cubejsStateAfter(moves));
    }
  });
});

describe('solveKociembaSync', () => {
  it('solves 200 seeded scrambles in at most 22 moves each', () => {
    const rng = seededRng(99);
    for (let i = 0; i < 200; i += 1) {
      const scrambled = applyMoves(solvedState(), randomScramble(25, rng));
      const solution = solveKociembaSync(scrambled);
      expect(solution.method).toBe('kociemba');
      expect(solution.steps).toHaveLength(1);
      const step = solution.steps[0];
      if (step === undefined) throw new Error('unreachable');
      expect(step.stage).toBe('optimal');
      expect(step.moves.length).toBeLessThanOrEqual(22);
      expect(isSolved(applyMoves(scrambled, step.moves))).toBe(true);
    }
  }, 120_000);

  it('reports distance 0 for the solved cube', () => {
    expect(kociembaDistanceSync(solvedState())).toBe(0);
  });
});
