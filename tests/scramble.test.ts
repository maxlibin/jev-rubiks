import { describe, expect, it } from 'vitest';
import { invert } from '../src/cube/notation';
import { randomScramble, seededRng } from '../src/cube/scramble';
import { applyMoves, isSolved, solvedState } from '../src/cube/state';

describe('randomScramble', () => {
  it('is deterministic for a seed and never repeats a face consecutively', () => {
    const a = randomScramble(25, seededRng(7));
    const b = randomScramble(25, seededRng(7));
    expect(a).toEqual(b);
    expect(a).toHaveLength(25);
    for (let i = 1; i < a.length; i += 1) {
      expect(a[i]?.face).not.toBe(a[i - 1]?.face);
    }
  });

  it('scramble followed by its inverse is solved', () => {
    const scramble = randomScramble(30, seededRng(42));
    const state = applyMoves(applyMoves(solvedState(), scramble), invert(scramble));
    expect(isSolved(state)).toBe(true);
  });

  it('leaves the cube unsolved for a real scramble', () => {
    expect(isSolved(applyMoves(solvedState(), randomScramble(20, seededRng(1))))).toBe(false);
  });
});
