import { describe, expect, it } from 'vitest';
import { formatNotation } from '../../src/cube/notation';
import { applyMoves, solvedState } from '../../src/cube/state';
import {
  algorithm,
  findCorner,
  findEdge,
  isPlaced,
  leftOf,
  remapForFront,
  rightOf,
  uTurnsFrom,
  EDGE_SLOTS,
  CORNER_SLOTS,
} from '../../src/solver/beginner/pieces';

describe('side helpers', () => {
  it('rotates sides F → R → B → L', () => {
    expect(rightOf('F')).toBe('R');
    expect(rightOf('L')).toBe('F');
    expect(leftOf('F')).toBe('L');
  });

  it('remaps an F-side algorithm to the R side', () => {
    const remapped = remapForFront(algorithm("U R U' R' U' F' U F"), 'R');
    expect(formatNotation(remapped)).toBe("U B U' B' U' R' U R");
  });

  it('counts U turns needed to carry a piece from one side to another', () => {
    expect(uTurnsFrom('F', 'F')).toBe(0);
    expect(uTurnsFrom('F', 'L')).toBe(1);
    expect(uTurnsFrom('F', 'B')).toBe(2);
    expect(uTurnsFrom('F', 'R')).toBe(3);
  });

  it('algorithm() rejects whole-cube rotations', () => {
    expect(() => algorithm('R x')).toThrow();
  });
});

describe('piece lookup', () => {
  it('finds the white-green edge at DF in the solved cube, white facelet first', () => {
    const edge = findEdge(solvedState(), 'white', 'green');
    expect(edge.slot).toBe('DF');
    expect(edge.facelets).toEqual([28, 25]);
  });

  it('tracks the white-green edge after F2 (it goes to UF, white on U)', () => {
    const state = applyMoves(solvedState(), algorithm('F2'));
    const edge = findEdge(state, 'white', 'green');
    expect(edge.slot).toBe('UF');
    expect(edge.facelets[0]).toBe(7);
  });

  it('finds the white-green-orange corner at DFR', () => {
    const corner = findCorner(solvedState(), ['white', 'green', 'orange']);
    expect(corner.slot).toBe('DFR');
    expect(corner.facelets).toEqual(CORNER_SLOTS.DFR);
  });

  it('isPlaced checks facelets against their face colours', () => {
    expect(isPlaced(solvedState(), EDGE_SLOTS.DF)).toBe(true);
    expect(isPlaced(applyMoves(solvedState(), algorithm('F')), EDGE_SLOTS.DF)).toBe(false);
  });
});
