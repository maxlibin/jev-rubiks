import { faceletColor, faceOfFacelet, toFaceletString } from '../../cube/state';
import { COLOR_FACE, FACE_COLOR, type CubeState, type Move } from '../../cube/types';
import { simplifyMoves } from '../../cube/notation';
import { SolverStuckError, type SolveStep } from '../types';
import {
  algorithm,
  EDGE_INFO,
  EDGE_SLOTS,
  findEdge,
  isPlaced,
  MIDDLE_EDGE_OF,
  record,
  remapForFront,
  rightOf,
  SIDES,
  uTurns,
  uTurnsFrom,
  type Recorder,
  type Side,
  type StageResult,
} from './pieces';

const INSERT_RIGHT = algorithm("U R U' R' U' F' U F");
const INSERT_LEFT = algorithm("U' L' U L U F U' F'");

export function middleEdgesDone(state: CubeState): boolean {
  return SIDES.every((side) => isPlaced(state, EDGE_SLOTS[MIDDLE_EDGE_OF[side]]));
}

function isSide(face: string): face is Side {
  return (SIDES as readonly string[]).includes(face);
}

function placeMiddleEdge(start: CubeState, side: Side): { readonly moves: readonly Move[]; readonly state: CubeState } {
  const a = FACE_COLOR[side];
  const b = FACE_COLOR[rightOf(side)];
  const target = EDGE_SLOTS[MIDDLE_EDGE_OF[side]];
  let recorder: Recorder = { state: start, moves: [] };
  const locate = () => findEdge(recorder.state, a, b);

  if (isPlaced(recorder.state, target)) return { moves: [], state: recorder.state };

  // 1. If the edge is in the middle layer (wrong slot or flipped), pop it out into the U layer.
  const first = locate();
  if (EDGE_INFO[first.slot].layer === 'middle') {
    recorder = record(recorder, remapForFront(INSERT_RIGHT, EDGE_INFO[first.slot].side));
  }

  // 2. Turn U so the edge's side sticker sits on the face of its own colour.
  const lifted = locate();
  if (EDGE_INFO[lifted.slot].layer !== 'U') {
    throw new SolverStuckError('middle_edges', toFaceletString(recorder.state), `edge ${a}-${b} not in U layer after pop-out`);
  }
  const sideFacelet = lifted.facelets.find((index) => faceOfFacelet(index) !== 'U');
  if (sideFacelet === undefined) throw new SolverStuckError('middle_edges', toFaceletString(recorder.state), 'U-layer edge without a side facelet');
  const sideColorFace = COLOR_FACE[faceletColor(recorder.state, sideFacelet)];
  if (!isSide(sideColorFace)) {
    throw new SolverStuckError('middle_edges', toFaceletString(recorder.state), `edge ${a}-${b} shows a U/D colour sideways`);
  }
  recorder = record(recorder, uTurns(uTurnsFrom(EDGE_INFO[lifted.slot].side, sideColorFace)));

  // 3. Insert right or left depending on where the up-facing colour belongs.
  const aligned = locate();
  const upFacelet = aligned.facelets.find((index) => faceOfFacelet(index) === 'U');
  if (upFacelet === undefined) throw new SolverStuckError('middle_edges', toFaceletString(recorder.state), 'aligned edge lost its U facelet');
  const upColorFace = COLOR_FACE[faceletColor(recorder.state, upFacelet)];
  const insert = upColorFace === rightOf(sideColorFace) ? INSERT_RIGHT : INSERT_LEFT;
  recorder = record(recorder, remapForFront(insert, sideColorFace));

  if (!isPlaced(recorder.state, target)) {
    throw new SolverStuckError('middle_edges', toFaceletString(recorder.state), `edge ${a}-${b} not placed after insert`);
  }
  return { moves: recorder.moves, state: recorder.state };
}

export function solveMiddleEdges(start: CubeState): StageResult {
  let state = start;
  const steps: SolveStep[] = [];
  for (const side of SIDES) {
    const placed = placeMiddleEdge(state, side);
    state = placed.state;
    if (placed.moves.length > 0) {
      steps.push({
        stage: 'middle_edges',
        moves: simplifyMoves(placed.moves),
        targetFacelets: EDGE_SLOTS[MIDDLE_EDGE_OF[side]],
        note: `Insert the ${FACE_COLOR[side]}-${FACE_COLOR[rightOf(side)]} edge between the ${FACE_COLOR[side]} and ${FACE_COLOR[rightOf(side)]} centres`,
      });
    }
  }
  if (!middleEdgesDone(state)) {
    throw new SolverStuckError('middle_edges', toFaceletString(state), 'middle layer incomplete');
  }
  return { steps, state };
}
