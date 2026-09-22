import { faceOfFacelet, toFaceletString } from '../../cube/state';
import { FACE_COLOR, type CubeState, type Move } from '../../cube/types';
import { simplifyMoves } from '../../cube/notation';
import { SolverStuckError, type SolveStep } from '../types';
import {
  algorithm,
  D_EDGE_OF,
  EDGE_INFO,
  EDGE_SLOTS,
  findEdge,
  isPlaced,
  record,
  remapForFront,
  SIDES,
  U_EDGE_OF,
  uTurns,
  uTurnsFrom,
  type Recorder,
  type Side,
  type StageResult,
} from './pieces';

const LIFT_FROM_MIDDLE = algorithm("R U R'");
const INSERT_WHITE_SIDEWAYS = algorithm("U' R' F R");

export function whiteCrossDone(state: CubeState): boolean {
  return SIDES.every((side) => isPlaced(state, EDGE_SLOTS[D_EDGE_OF[side]]));
}

/** Moves that put the white edge belonging to `side` into its D slot, white facing down. */
function placeCrossEdge(start: CubeState, side: Side): { readonly moves: readonly Move[]; readonly state: CubeState } {
  const color = FACE_COLOR[side];
  let recorder: Recorder = { state: start, moves: [] };
  const locate = () => findEdge(recorder.state, 'white', color);

  if (isPlaced(recorder.state, EDGE_SLOTS[D_EDGE_OF[side]])) return { moves: [], state: recorder.state };

  // 1. Bring the edge into the U layer without touching other D edges.
  const first = locate();
  const info = EDGE_INFO[first.slot];
  if (info.layer === 'D') {
    recorder = record(recorder, [{ face: info.side, turns: 2 }]);
  } else if (info.layer === 'middle') {
    recorder = record(recorder, remapForFront(LIFT_FROM_MIDDLE, info.side));
  }

  // 2. Turn U until the edge sits above its slot.
  const lifted = locate();
  if (EDGE_INFO[lifted.slot].layer !== 'U') {
    throw new SolverStuckError('white_cross', toFaceletString(recorder.state), `edge white-${color} not in U layer after lift`);
  }
  recorder = record(recorder, uTurns(uTurnsFrom(EDGE_INFO[lifted.slot].side, side)));

  // 3. Insert: white up needs a half turn; white sideways needs the four-move insert.
  const aligned = locate();
  if (aligned.slot !== U_EDGE_OF[side]) {
    throw new SolverStuckError('white_cross', toFaceletString(recorder.state), `edge white-${color} not above its slot`);
  }
  if (faceOfFacelet(aligned.facelets[0]) === 'U') {
    recorder = record(recorder, [{ face: side, turns: 2 }]);
  } else {
    recorder = record(recorder, remapForFront(INSERT_WHITE_SIDEWAYS, side));
  }

  if (!isPlaced(recorder.state, EDGE_SLOTS[D_EDGE_OF[side]])) {
    throw new SolverStuckError('white_cross', toFaceletString(recorder.state), `edge white-${color} not placed after insert`);
  }
  return { moves: recorder.moves, state: recorder.state };
}

export function solveWhiteCross(start: CubeState): StageResult {
  let state = start;
  const steps: SolveStep[] = [];
  for (const side of SIDES) {
    const placed = placeCrossEdge(state, side);
    state = placed.state;
    if (placed.moves.length > 0) {
      const color = FACE_COLOR[side];
      steps.push({
        stage: 'white_cross',
        moves: simplifyMoves(placed.moves),
        targetFacelets: EDGE_SLOTS[D_EDGE_OF[side]],
        note: `Place the white-${color} edge between the white and ${color} centres, white facing down`,
      });
    }
  }
  if (!whiteCrossDone(state)) {
    throw new SolverStuckError('white_cross', toFaceletString(state), 'cross incomplete after all four edges');
  }
  return { steps, state };
}
