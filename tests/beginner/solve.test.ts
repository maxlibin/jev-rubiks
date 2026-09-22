import { describe, expect, it } from 'vitest';
import { randomScramble, seededRng } from '../../src/cube/scramble';
import { applyMoves, isSolved, solvedState } from '../../src/cube/state';
import { solveBeginner } from '../../src/solver/beginner/index';

describe('solveBeginner', () => {
  it('solves 200 seeded scrambles with explainable steps', () => {
    const rng = seededRng(2026);
    const lengths: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const start = applyMoves(solvedState(), randomScramble(25, rng));
      const solution = solveBeginner(start);
      expect(solution.method).toBe('beginner');
      const moves = solution.steps.flatMap((step) => step.moves);
      expect(isSolved(applyMoves(start, moves))).toBe(true);
      for (const step of solution.steps) {
        expect(step.note.length).toBeGreaterThan(10);
        expect(step.moves.length).toBeGreaterThan(0);
      }
      lengths.push(moves.length);
    }
    lengths.sort((a, b) => a - b);
    expect(lengths[100]).toBeLessThan(220);
    expect(lengths[199]).toBeLessThan(300);
  });

  it('returns an empty solution for a solved cube', () => {
    expect(solveBeginner(solvedState()).steps).toEqual([]);
  });
});
