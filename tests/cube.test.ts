import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyMoves,
  faceGrid,
  fromFaceletString,
  InvalidFaceletStringError,
  isSolved,
  solvedState,
  toFaceletString,
} from '../src/cube/state';
import type { Move } from '../src/cube/types';

const SOLVED_STRING = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

describe('solved state', () => {
  it('has 54 facelets, nine per face in U R F D L B order', () => {
    const state = solvedState();
    expect(state).toHaveLength(54);
    expect(toFaceletString(state)).toBe(SOLVED_STRING);
    expect(isSolved(state)).toBe(true);
  });

  it('exposes a face as a 3x3 grid of colours', () => {
    expect(faceGrid(solvedState(), 'F')).toEqual([
      ['green', 'green', 'green'],
      ['green', 'green', 'green'],
      ['green', 'green', 'green'],
    ]);
  });

  it('round-trips through the facelet string', () => {
    expect(fromFaceletString(SOLVED_STRING)).toEqual(solvedState());
  });

  it('rejects malformed facelet strings', () => {
    expect(() => fromFaceletString('UUU')).toThrow(InvalidFaceletStringError);
    expect(() => fromFaceletString(SOLVED_STRING.replace('U', 'X'))).toThrow(InvalidFaceletStringError);
  });
});

const R: Move = { face: 'R', turns: 1 };
const RP: Move = { face: 'R', turns: 3 };
const U: Move = { face: 'U', turns: 1 };
const UP: Move = { face: 'U', turns: 3 };

describe('applyMove', () => {
  it('does not mutate its input', () => {
    const before = solvedState();
    const copy = [...before];
    applyMove(before, R);
    expect([...before]).toEqual(copy);
  });

  it('R four times is the identity', () => {
    const state = applyMoves(solvedState(), [R, R, R, R]);
    expect(isSolved(state)).toBe(true);
  });

  it('R then R prime is the identity, R2 equals R twice', () => {
    expect(isSolved(applyMoves(solvedState(), [R, RP]))).toBe(true);
    expect(applyMove(solvedState(), { face: 'R', turns: 2 })).toEqual(applyMoves(solvedState(), [R, R]));
  });

  it("(R U R' U') six times is the identity, and once is not", () => {
    const sexy = [R, U, RP, UP];
    expect(isSolved(applyMoves(solvedState(), sexy))).toBe(false);
    expect(isSolved(applyMoves(solvedState(), [...sexy, ...sexy, ...sexy, ...sexy, ...sexy, ...sexy]))).toBe(true);
  });

  it('U moves the front top row to the left face', () => {
    const state = applyMove(solvedState(), U);
    expect(faceGrid(state, 'L')[0]).toEqual(['green', 'green', 'green']);
    expect(faceGrid(state, 'F')[0]).toEqual(['orange', 'orange', 'orange']);
    expect(faceGrid(state, 'R')[0]).toEqual(['blue', 'blue', 'blue']);
    expect(faceGrid(state, 'B')[0]).toEqual(['red', 'red', 'red']);
  });

  it('R moves the front right column up', () => {
    const state = applyMove(solvedState(), R);
    expect(toFaceletString(state)).toBe('UUFUUFUUFRRRRRRRRRFFDFFDFFDDDBDDBDDBLLLLLLLLLUBBUBBUBB');
  });
});
