import { isMove, parseNotation } from '../../cube/notation';
import { applyMoves, faceletColor, faceOfFacelet } from '../../cube/state';
import { FACE_COLOR, type Color, type CubeState, type Face, type Move, type Turns } from '../../cube/types';
import type { SolveStep } from '../types';

export type StageResult = { readonly steps: readonly SolveStep[]; readonly state: CubeState };

export type EdgeSlot = 'UR' | 'UF' | 'UL' | 'UB' | 'DR' | 'DF' | 'DL' | 'DB' | 'FR' | 'FL' | 'BL' | 'BR';
export type CornerSlot = 'URF' | 'UFL' | 'ULB' | 'UBR' | 'DFR' | 'DLF' | 'DBL' | 'DRB';

/** Facelet pairs per edge slot (Kociemba's edge table); first entry is the U/D/F/B facelet. */
export const EDGE_SLOTS: Readonly<Record<EdgeSlot, readonly [number, number]>> = {
  UR: [5, 10],
  UF: [7, 19],
  UL: [3, 37],
  UB: [1, 46],
  DR: [32, 16],
  DF: [28, 25],
  DL: [30, 43],
  DB: [34, 52],
  FR: [23, 12],
  FL: [21, 41],
  BL: [50, 39],
  BR: [48, 14],
};

/** Facelet triples per corner slot (Kociemba's corner table); first entry is the U/D facelet. */
export const CORNER_SLOTS: Readonly<Record<CornerSlot, readonly [number, number, number]>> = {
  URF: [8, 9, 20],
  UFL: [6, 18, 38],
  ULB: [0, 36, 47],
  UBR: [2, 45, 11],
  DFR: [29, 26, 15],
  DLF: [27, 44, 24],
  DBL: [33, 53, 42],
  DRB: [35, 17, 51],
};

export const SIDES = ['F', 'R', 'B', 'L'] as const;
export type Side = (typeof SIDES)[number];

export type Layer = 'U' | 'D' | 'middle';

/** For each edge slot: its layer and its reference side (for middle slots, the left side of the pair). */
export const EDGE_INFO: Readonly<Record<EdgeSlot, { readonly layer: Layer; readonly side: Side }>> = {
  UR: { layer: 'U', side: 'R' },
  UF: { layer: 'U', side: 'F' },
  UL: { layer: 'U', side: 'L' },
  UB: { layer: 'U', side: 'B' },
  DR: { layer: 'D', side: 'R' },
  DF: { layer: 'D', side: 'F' },
  DL: { layer: 'D', side: 'L' },
  DB: { layer: 'D', side: 'B' },
  FR: { layer: 'middle', side: 'F' },
  FL: { layer: 'middle', side: 'L' },
  BL: { layer: 'middle', side: 'B' },
  BR: { layer: 'middle', side: 'R' },
};

/** For each corner slot: its layer and the left side of its two side faces. */
export const CORNER_INFO: Readonly<Record<CornerSlot, { readonly layer: 'U' | 'D'; readonly side: Side }>> = {
  URF: { layer: 'U', side: 'F' },
  UBR: { layer: 'U', side: 'R' },
  ULB: { layer: 'U', side: 'B' },
  UFL: { layer: 'U', side: 'L' },
  DFR: { layer: 'D', side: 'F' },
  DRB: { layer: 'D', side: 'R' },
  DBL: { layer: 'D', side: 'B' },
  DLF: { layer: 'D', side: 'L' },
};

export const U_EDGE_OF: Readonly<Record<Side, EdgeSlot>> = { F: 'UF', R: 'UR', B: 'UB', L: 'UL' };
export const D_EDGE_OF: Readonly<Record<Side, EdgeSlot>> = { F: 'DF', R: 'DR', B: 'DB', L: 'DL' };
/** Middle slot between `side` and `rightOf(side)`. */
export const MIDDLE_EDGE_OF: Readonly<Record<Side, EdgeSlot>> = { F: 'FR', R: 'BR', B: 'BL', L: 'FL' };
/** Corner slot between `side` and `rightOf(side)` in the U / D layer. */
export const U_CORNER_OF: Readonly<Record<Side, CornerSlot>> = { F: 'URF', R: 'UBR', B: 'ULB', L: 'UFL' };
export const D_CORNER_OF: Readonly<Record<Side, CornerSlot>> = { F: 'DFR', R: 'DRB', B: 'DBL', L: 'DLF' };

export function rightOf(side: Side): Side {
  return SIDES[(SIDES.indexOf(side) + 1) % 4] as Side;
}

export function leftOf(side: Side): Side {
  return SIDES[(SIDES.indexOf(side) + 3) % 4] as Side;
}

/** Rewrites an algorithm written for the F side so it applies to `front`; U and D are unchanged. */
export function remapForFront(moves: readonly Move[], front: Side): readonly Move[] {
  const map: Readonly<Record<Face, Face>> = {
    U: 'U',
    D: 'D',
    F: front,
    R: rightOf(front),
    B: rightOf(rightOf(front)),
    L: leftOf(front),
  };
  return moves.map((move) => ({ face: map[move.face], turns: move.turns }));
}

/** `count` clockwise U turns (0–3) as zero or one move. */
export function uTurns(count: number): readonly Move[] {
  if (count === 0) return [];
  if (count === 1 || count === 2 || count === 3) return [{ face: 'U', turns: count as Turns }];
  throw new RangeError(`uTurns expects 0–3, got ${count}`);
}

/** How many U turns carry a U-layer piece from side `from` to side `to` (U moves F → L → B → R). */
export function uTurnsFrom(from: Side, to: Side): number {
  let count = 0;
  let current = from;
  while (current !== to) {
    current = leftOf(current);
    count += 1;
  }
  return count;
}

/** Parses notation that must contain face moves only. */
export function algorithm(text: string): readonly Move[] {
  return parseNotation(text).map((item) => {
    if (!isMove(item)) throw new Error(`Algorithm "${text}" contains a whole-cube rotation`);
    return item;
  });
}

export type EdgeLocation = { readonly slot: EdgeSlot; readonly facelets: readonly [number, number] };

/** Locates the edge with colours `a` and `b`; `facelets[0]` is the facelet showing `a`. */
export function findEdge(state: CubeState, a: Color, b: Color): EdgeLocation {
  for (const [slot, [i, j]] of Object.entries(EDGE_SLOTS) as [EdgeSlot, readonly [number, number]][]) {
    const ci = faceletColor(state, i);
    const cj = faceletColor(state, j);
    if (ci === a && cj === b) return { slot, facelets: [i, j] };
    if (cj === a && ci === b) return { slot, facelets: [j, i] };
  }
  throw new Error(`Edge ${a}-${b} not found`);
}

export type CornerLocation = { readonly slot: CornerSlot; readonly facelets: readonly [number, number, number] };

/** Locates the corner carrying exactly these three colours; facelets are in slot order. */
export function findCorner(state: CubeState, colors: readonly [Color, Color, Color]): CornerLocation {
  for (const [slot, facelets] of Object.entries(CORNER_SLOTS) as [CornerSlot, readonly [number, number, number]][]) {
    const present = facelets.map((index) => faceletColor(state, index));
    if (colors.every((color) => present.includes(color))) return { slot, facelets };
  }
  throw new Error(`Corner ${colors.join('-')} not found`);
}

/** True when every listed facelet shows the colour of the face it is on. */
export function isPlaced(state: CubeState, facelets: readonly number[]): boolean {
  return facelets.every((index) => faceletColor(state, index) === FACE_COLOR[faceOfFacelet(index)]);
}

/** Immutable accumulator every stage threads through: the state so far and the moves that produced it. */
export type Recorder = { readonly state: CubeState; readonly moves: readonly Move[] };

export function record(recorder: Recorder, moves: readonly Move[]): Recorder {
  return { state: applyMoves(recorder.state, moves), moves: [...recorder.moves, ...moves] };
}
