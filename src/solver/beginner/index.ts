import { isSolved, toFaceletString } from '../../cube/state';
import type { CubeState } from '../../cube/types';
import { SolverStuckError, type Solution, type SolveStep } from '../types';
import { solveWhiteCorners } from './corners';
import { solveWhiteCross } from './cross';
import { solveYellowCorners, solveYellowCross, solveYellowEdges, solveYellowFace } from './lastLayer';
import { solveMiddleEdges } from './middle';
import type { StageResult } from './pieces';

const STAGES: readonly ((state: CubeState) => StageResult)[] = [
  solveWhiteCross,
  solveWhiteCorners,
  solveMiddleEdges,
  solveYellowCross,
  solveYellowFace,
  solveYellowCorners,
  solveYellowEdges,
];

export function solveBeginner(start: CubeState): Solution {
  let state = start;
  const steps: SolveStep[] = [];
  for (const stage of STAGES) {
    const result = stage(state);
    steps.push(...result.steps);
    state = result.state;
  }
  if (!isSolved(state)) {
    throw new SolverStuckError('yellow_edges', toFaceletString(state), 'all stages ran but the cube is not solved');
  }
  return { method: 'beginner', steps };
}
