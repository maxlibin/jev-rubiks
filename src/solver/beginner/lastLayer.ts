import { formatNotation } from '../../cube/notation';
import { applyMoves, faceletColor, isSolved, toFaceletString } from '../../cube/state';
import type { CubeState, Move } from '../../cube/types';
import { SolverStuckError, type SolveStep, type Stage } from '../types';
import { algorithm, CORNER_SLOTS, isPlaced, uTurns, type StageResult } from './pieces';

export type SearchParams = {
  readonly state: CubeState;
  readonly stage: Stage;
  readonly algorithm: readonly Move[];
  readonly algorithmName: string;
  readonly goal: (state: CubeState) => boolean;
  readonly targetFacelets: readonly number[];
  readonly maxDepth: number;
};

type Node = { readonly state: CubeState; readonly steps: readonly SolveStep[] };

const U_TURN_WORDS = ['', 'Turn the top face clockwise, then ', 'Turn the top face twice, then ', 'Turn the top face counter-clockwise, then '] as const;

function alignmentStep(stage: Stage, count: number, targetFacelets: readonly number[]): SolveStep | null {
  if (count === 0) return null;
  return { stage, moves: uTurns(count), targetFacelets, note: 'Align the top layer with the centres' };
}

/** Number of trailing U turns (0–3) after which the goal holds, or null. */
function findAlignment(params: SearchParams, state: CubeState): number | null {
  for (let j = 0; j < 4; j += 1) {
    if (params.goal(applyMoves(state, uTurns(j)))) return j;
  }
  return null;
}

/** Breadth-first search over rounds of (U^k, algorithm), plus a final U alignment, until the goal holds. */
export function searchWithAlgorithm(params: SearchParams): StageResult {
  let frontier: readonly Node[] = [{ state: params.state, steps: [] }];
  for (let depth = 0; depth <= params.maxDepth; depth += 1) {
    for (const node of frontier) {
      const align = findAlignment(params, node.state);
      if (align !== null) {
        const final = alignmentStep(params.stage, align, params.targetFacelets);
        return {
          steps: final === null ? node.steps : [...node.steps, final],
          state: applyMoves(node.state, uTurns(align)),
        };
      }
    }
    frontier = frontier.flatMap((node) =>
      [0, 1, 2, 3].map((k): Node => {
        const moves = [...uTurns(k), ...params.algorithm];
        const prefix = U_TURN_WORDS[k] ?? '';
        const step: SolveStep = {
          stage: params.stage,
          moves,
          targetFacelets: params.targetFacelets,
          note: `${prefix}${prefix === '' ? 'Apply' : 'apply'} ${params.algorithmName} (${formatNotation(params.algorithm)})`,
        };
        return { state: applyMoves(node.state, moves), steps: [...node.steps, step] };
      }),
    );
  }
  throw new SolverStuckError(params.stage, toFaceletString(params.state), `no solution within ${params.maxDepth} applications of ${params.algorithmName}`);
}

const MAX_DEPTH = 6;
const U_EDGE_FACELETS = [1, 3, 5, 7] as const;
const U_FACELETS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const U_CORNER_SIDE_FACELETS = [9, 20, 18, 38, 36, 47, 45, 11] as const;
const U_EDGE_SIDE_FACELETS = [10, 19, 37, 46] as const;

export function yellowCrossDone(state: CubeState): boolean {
  return U_EDGE_FACELETS.every((index) => faceletColor(state, index) === 'yellow');
}

export function yellowFaceDone(state: CubeState): boolean {
  return U_FACELETS.every((index) => faceletColor(state, index) === 'yellow');
}

export function yellowCornersDone(state: CubeState): boolean {
  return (['URF', 'UFL', 'ULB', 'UBR'] as const).every((slot) => isPlaced(state, CORNER_SLOTS[slot]));
}

export function solveYellowCross(state: CubeState): StageResult {
  return searchWithAlgorithm({
    state,
    stage: 'yellow_cross',
    algorithm: algorithm("F R U R' U' F'"),
    algorithmName: 'the cross algorithm',
    goal: yellowCrossDone,
    targetFacelets: U_EDGE_FACELETS,
    maxDepth: MAX_DEPTH,
  });
}

export function solveYellowFace(state: CubeState): StageResult {
  return searchWithAlgorithm({
    state,
    stage: 'yellow_face',
    algorithm: algorithm("R U R' U R U2 R'"),
    algorithmName: 'Sune',
    goal: yellowFaceDone,
    targetFacelets: U_FACELETS,
    maxDepth: MAX_DEPTH,
  });
}

export function solveYellowCorners(state: CubeState): StageResult {
  return searchWithAlgorithm({
    state,
    stage: 'yellow_corners',
    algorithm: algorithm("U R U' L' U R' U' L"),
    algorithmName: 'Niklas (corner cycle)',
    goal: yellowCornersDone,
    targetFacelets: U_CORNER_SIDE_FACELETS,
    maxDepth: MAX_DEPTH,
  });
}

export function solveYellowEdges(state: CubeState): StageResult {
  return searchWithAlgorithm({
    state,
    stage: 'yellow_edges',
    algorithm: algorithm("R U' R U R U R U' R' U' R2"),
    algorithmName: 'the U-perm (edge cycle)',
    goal: isSolved,
    targetFacelets: U_EDGE_SIDE_FACELETS,
    maxDepth: MAX_DEPTH,
  });
}
