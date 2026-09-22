import Cube from 'cubejs';
import { formatNotation, isMove, parseNotation } from '../cube/notation';
import { isSolved, toFaceletString } from '../cube/state';
import type { CubeState, Move } from '../cube/types';
import type { Solution } from './types';

const MAX_DEPTH = 22;

// cubejs keeps its pruning tables in module state; initialise once per process.
let ready = false;

export function ensureKociembaReady(): void {
  if (!ready) {
    Cube.initSolver();
    ready = true;
  }
}

function movesOnly(text: string): readonly Move[] {
  return parseNotation(text).map((item) => {
    if (!isMove(item)) {
      throw new Error(`cubejs returned a rotation in its solution: "${text}"`);
    }
    return item;
  });
}

function solveWithCubejs(state: CubeState): readonly Move[] {
  ensureKociembaReady();
  return movesOnly(Cube.fromString(toFaceletString(state)).solve(MAX_DEPTH));
}

export function solveKociembaSync(state: CubeState): Solution {
  // cubejs answers a solved cube with a 14-move identity sequence; zero moves is the truthful answer.
  const moves = isSolved(state) ? [] : solveWithCubejs(state);
  return {
    method: 'kociemba',
    steps: [
      {
        stage: 'optimal',
        moves,
        targetFacelets: [],
        note: `Two-phase solution in ${moves.length} moves`,
      },
    ],
  };
}

/** Solution length from the two-phase solver: a cheap distance-from-solved metric. */
export function kociembaDistanceSync(state: CubeState): number {
  const step = solveKociembaSync(state).steps[0];
  if (step === undefined) {
    throw new Error('solveKociembaSync returned no steps');
  }
  return step.moves.length;
}

/** Facelet string cubejs produces after applying `moves` to a solved cube. Test helper. */
export function cubejsStateAfter(moves: readonly Move[]): string {
  const cube = new Cube();
  cube.move(formatNotation(moves));
  return cube.asString();
}
