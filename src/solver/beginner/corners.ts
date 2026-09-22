import { toFaceletString } from '../../cube/state';
import { FACE_COLOR, type CubeState, type Move } from '../../cube/types';
import { simplifyMoves } from '../../cube/notation';
import { SolverStuckError, type SolveStep } from '../types';
import {
  algorithm,
  CORNER_INFO,
  CORNER_SLOTS,
  D_CORNER_OF,
  findCorner,
  isPlaced,
  record,
  remapForFront,
  rightOf,
  SIDES,
  U_CORNER_OF,
  uTurns,
  uTurnsFrom,
  type Recorder,
  type Side,
  type StageResult,
} from './pieces';

const LIFT_FROM_D = algorithm("R U R'");
const INSERT_RIGHT = algorithm("R U R' U'");
const INSERT_LEFT = algorithm("F' U' F U");
const MAX_INSERT_REPEATS = 6;

export function whiteCornersDone(state: CubeState): boolean {
  return SIDES.every((side) => isPlaced(state, CORNER_SLOTS[D_CORNER_OF[side]]));
}

/** Repeats `insert` (remapped to `side`) until the corner is placed; null if the bound is hit. */
function insertUntilPlaced(state: CubeState, side: Side, insert: readonly Move[]): readonly Move[] | null {
  const target = CORNER_SLOTS[D_CORNER_OF[side]];
  let recorder: Recorder = { state, moves: [] };
  for (let i = 0; i < MAX_INSERT_REPEATS && !isPlaced(recorder.state, target); i += 1) {
    recorder = record(recorder, remapForFront(insert, side));
  }
  return isPlaced(recorder.state, target) ? recorder.moves : null;
}

function placeCorner(start: CubeState, side: Side): { readonly moves: readonly Move[]; readonly state: CubeState } {
  const colors = ['white', FACE_COLOR[side], FACE_COLOR[rightOf(side)]] as const;
  const target = CORNER_SLOTS[D_CORNER_OF[side]];
  let recorder: Recorder = { state: start, moves: [] };
  const locate = () => findCorner(recorder.state, colors);

  if (isPlaced(recorder.state, target)) return { moves: [], state: recorder.state };

  // 1. If the corner is in the D layer (wrong slot or twisted), lift it into the U layer.
  const first = locate();
  if (CORNER_INFO[first.slot].layer === 'D') {
    recorder = record(recorder, remapForFront(LIFT_FROM_D, CORNER_INFO[first.slot].side));
  }

  // 2. Turn U until the corner sits above its slot.
  const lifted = locate();
  recorder = record(recorder, uTurns(uTurnsFrom(CORNER_INFO[lifted.slot].side, side)));
  if (locate().slot !== U_CORNER_OF[side]) {
    throw new SolverStuckError('white_corners', toFaceletString(recorder.state), `corner ${colors.join('-')} not above its slot`);
  }

  // 3. Insert with whichever hand needs fewer repetitions.
  const candidates = [INSERT_RIGHT, INSERT_LEFT]
    .map((insert) => insertUntilPlaced(recorder.state, side, insert))
    .filter((moves): moves is readonly Move[] => moves !== null);
  const best = candidates.reduce<readonly Move[] | null>((a, b) => (a === null || b.length < a.length ? b : a), null);
  if (best === null) {
    throw new SolverStuckError('white_corners', toFaceletString(recorder.state), `corner ${colors.join('-')} not placed within ${MAX_INSERT_REPEATS} repeats`);
  }
  recorder = record(recorder, best);
  return { moves: recorder.moves, state: recorder.state };
}

export function solveWhiteCorners(start: CubeState): StageResult {
  let state = start;
  const steps: SolveStep[] = [];
  for (const side of SIDES) {
    const placed = placeCorner(state, side);
    state = placed.state;
    if (placed.moves.length > 0) {
      steps.push({
        stage: 'white_corners',
        moves: simplifyMoves(placed.moves),
        targetFacelets: CORNER_SLOTS[D_CORNER_OF[side]],
        note: `Place the white-${FACE_COLOR[side]}-${FACE_COLOR[rightOf(side)]} corner, white facing down`,
      });
    }
  }
  if (!whiteCornersDone(state)) {
    throw new SolverStuckError('white_corners', toFaceletString(state), 'first layer incomplete');
  }
  return { steps, state };
}
