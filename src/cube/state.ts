import { COLOR_FACE, FACE_COLOR, FACES, type Color, type CubeState, type Face, type Move } from './types';

export class InvalidFaceletStringError extends Error {
  constructor(text: string, reason: string) {
    super(`Invalid facelet string "${text}": ${reason}`);
    this.name = 'InvalidFaceletStringError';
  }
}

const FACELET_COUNT = 54;

function asCubeState(colors: readonly Color[]): CubeState {
  if (colors.length !== FACELET_COUNT) {
    throw new Error(`CubeState needs ${FACELET_COUNT} facelets, got ${colors.length}`);
  }
  return colors as CubeState;
}

export function faceOfFacelet(index: number): Face {
  const face = FACES[Math.floor(index / 9)];
  if (face === undefined) {
    throw new RangeError(`Facelet index out of range: ${index}`);
  }
  return face;
}

export function solvedState(): CubeState {
  return asCubeState(FACES.flatMap((face) => Array.from({ length: 9 }, () => FACE_COLOR[face])));
}

export function isSolved(state: CubeState): boolean {
  return state.every((color, index) => color === FACE_COLOR[faceOfFacelet(index)]);
}

export function faceletColor(state: CubeState, index: number): Color {
  const color = state[index];
  if (color === undefined) {
    throw new RangeError(`Facelet index out of range: ${index}`);
  }
  return color;
}

export function faceGrid(state: CubeState, face: Face): readonly (readonly [Color, Color, Color])[] {
  const base = FACES.indexOf(face) * 9;
  return [0, 3, 6].map((row) => [
    faceletColor(state, base + row),
    faceletColor(state, base + row + 1),
    faceletColor(state, base + row + 2),
  ]);
}

export function toFaceletString(state: CubeState): string {
  return state.map((color) => COLOR_FACE[color]).join('');
}

function isFace(letter: string): letter is Face {
  return (FACES as readonly string[]).includes(letter);
}

export function fromFaceletString(text: string): CubeState {
  if (text.length !== FACELET_COUNT) {
    throw new InvalidFaceletStringError(text, `expected ${FACELET_COUNT} characters, got ${text.length}`);
  }
  const colors = [...text].map((letter, index) => {
    if (!isFace(letter)) {
      throw new InvalidFaceletStringError(text, `character ${index} is "${letter}", expected one of U R F D L B`);
    }
    return FACE_COLOR[letter];
  });
  return asCubeState(colors);
}

type Cycle = readonly [number, number, number, number];

const FACE_BASE: Readonly<Record<Face, number>> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };

/**
 * Side-sticker cycles for one clockwise quarter turn, in Kociemba facelet
 * order. [a, b, c, d] means the sticker at a moves to b, b to c, c to d, d to a.
 * Derived from Kociemba's corner/edge facelet tables; verified against cubejs
 * in tests/kociemba.test.ts.
 */
const SIDE_CYCLES: Readonly<Record<Face, readonly Cycle[]>> = {
  U: [[18, 36, 45, 9], [19, 37, 46, 10], [20, 38, 47, 11]],
  R: [[20, 2, 51, 29], [23, 5, 48, 32], [26, 8, 45, 35]],
  F: [[6, 9, 29, 44], [7, 12, 28, 41], [8, 15, 27, 38]],
  D: [[24, 15, 51, 42], [25, 16, 52, 43], [26, 17, 53, 44]],
  L: [[0, 18, 27, 53], [3, 21, 30, 50], [6, 24, 33, 47]],
  B: [[0, 42, 35, 11], [1, 39, 34, 14], [2, 36, 33, 17]],
};

function quarterTurnCycles(face: Face): readonly Cycle[] {
  const b = FACE_BASE[face];
  const corners: Cycle = [b, b + 2, b + 8, b + 6];
  const edges: Cycle = [b + 1, b + 5, b + 7, b + 3];
  return [corners, edges, ...SIDE_CYCLES[face]];
}

const QUARTER_TURN_CYCLES: Readonly<Record<Face, readonly Cycle[]>> = {
  U: quarterTurnCycles('U'),
  R: quarterTurnCycles('R'),
  F: quarterTurnCycles('F'),
  D: quarterTurnCycles('D'),
  L: quarterTurnCycles('L'),
  B: quarterTurnCycles('B'),
};

function quarterTurn(state: CubeState, face: Face): CubeState {
  const next: Color[] = [...state];
  for (const [a, b, c, d] of QUARTER_TURN_CYCLES[face]) {
    next[b] = faceletColor(state, a);
    next[c] = faceletColor(state, b);
    next[d] = faceletColor(state, c);
    next[a] = faceletColor(state, d);
  }
  return asCubeState(next);
}

export function applyMove(state: CubeState, move: Move): CubeState {
  let next = state;
  for (let i = 0; i < move.turns; i += 1) {
    next = quarterTurn(next, move.face);
  }
  return next;
}

export function applyMoves(state: CubeState, moves: readonly Move[]): CubeState {
  return moves.reduce(applyMove, state);
}
