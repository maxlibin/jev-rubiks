import { formatNotation, invert } from '../cube/notation';
import { applyRotation, DEFAULT_ORIENTATION } from '../cube/orientation';
import { applyMove, isSolved, solvedState } from '../cube/state';
import type { CubeState, Move, Orientation, Rotation } from '../cube/types';
import type { Solution } from '../solver/types';

export type SolveMode = 'idle' | 'teach' | 'playing';

export type AppState = {
  readonly cube: CubeState;
  readonly orientation: Orientation;
  readonly history: readonly Move[];
  readonly solution: Solution | null;
  readonly stepIndex: number;
  readonly solveMode: SolveMode;
  readonly moveMs: number;
};

export type Action =
  | { readonly type: 'move'; readonly move: Move }
  | { readonly type: 'rotate'; readonly rotation: Rotation }
  | { readonly type: 'scramble'; readonly moves: readonly Move[] }
  | { readonly type: 'reset' }
  | { readonly type: 'undo' }
  | { readonly type: 'solutionReady'; readonly solution: Solution; readonly mode: 'teach' | 'playing' }
  | { readonly type: 'stepNext' }
  | { readonly type: 'playAll' }
  | { readonly type: 'stop' }
  | { readonly type: 'animationsIdle' }
  | { readonly type: 'setMoveMs'; readonly ms: number }
  | { readonly type: 'skipStage' }
  | { readonly type: 'highlightCurrentStep' };

export type Effect =
  | {
      readonly type: 'animate';
      readonly turnable: Move | Rotation;
      readonly state: CubeState;
      readonly orientation: Orientation;
      readonly durationMs: number;
    }
  | { readonly type: 'snap'; readonly state: CubeState; readonly orientation: Orientation }
  | { readonly type: 'highlight'; readonly facelets: readonly number[] }
  | { readonly type: 'log'; readonly text: string }
  | { readonly type: 'resetCamera' };

export type Reduction = { readonly next: AppState; readonly effects: readonly Effect[] };

export const DEFAULT_MOVE_MS = 180;
export const SCRAMBLE_MOVE_MS = 60;

export function initialState(): AppState {
  return {
    cube: solvedState(),
    orientation: DEFAULT_ORIENTATION,
    history: [],
    solution: null,
    stepIndex: 0,
    solveMode: 'idle',
    moveMs: DEFAULT_MOVE_MS,
  };
}

/** Animate `moves` one by one from `state.cube`; returns the new cube and the effects. */
function animateMoves(
  state: AppState,
  moves: readonly Move[],
  durationMs: number,
): { readonly cube: CubeState; readonly effects: readonly Effect[] } {
  let cube = state.cube;
  const effects: Effect[] = [];
  for (const move of moves) {
    cube = applyMove(cube, move);
    effects.push({ type: 'animate', turnable: move, state: cube, orientation: state.orientation, durationMs });
  }
  return { cube, effects };
}

function discardSolution(state: AppState): { readonly next: AppState; readonly effects: readonly Effect[] } {
  if (state.solution === null) return { next: state, effects: [] };
  return {
    next: { ...state, solution: null, stepIndex: 0, solveMode: 'idle' },
    effects: [{ type: 'highlight', facelets: [] }, { type: 'log', text: 'Solution discarded: the cube changed' }],
  };
}

function applyUserMoves(state: AppState, moves: readonly Move[], durationMs: number): Reduction {
  const discarded = discardSolution(state);
  const animated = animateMoves(discarded.next, moves, durationMs);
  return {
    next: { ...discarded.next, cube: animated.cube, history: [...discarded.next.history, ...moves] },
    effects: [...discarded.effects, ...animated.effects],
  };
}

function stepNext(state: AppState): Reduction {
  if (state.solution === null) {
    return { next: state, effects: [{ type: 'log', text: 'No solution loaded' }] };
  }
  const step = state.solution.steps[state.stepIndex];
  if (step === undefined) {
    const solvedText = isSolved(state.cube) ? 'Solved!' : 'Playback finished but the cube is not solved';
    return {
      next: { ...state, solveMode: 'idle' },
      effects: [{ type: 'highlight', facelets: [] }, { type: 'log', text: solvedText }],
    };
  }
  const animated = animateMoves(state, step.moves, state.moveMs);
  return {
    next: { ...state, cube: animated.cube, history: [...state.history, ...step.moves], stepIndex: state.stepIndex + 1 },
    effects: [
      { type: 'highlight', facelets: step.targetFacelets },
      { type: 'log', text: `[${step.stage}] ${step.note}: ${formatNotation(step.moves)}` },
      ...animated.effects,
    ],
  };
}

function skipStage(state: AppState): Reduction {
  if (state.solution === null) return { next: state, effects: [{ type: 'log', text: 'No solution loaded' }] };
  const current = state.solution.steps[state.stepIndex];
  if (current === undefined) return stepNext(state);
  let next = state;
  const effects: Effect[] = [];
  for (;;) {
    const step = next.solution?.steps[next.stepIndex];
    if (step === undefined || step.stage !== current.stage) break;
    const result = stepNext(next);
    next = result.next;
    effects.push(...result.effects);
  }
  return { next, effects };
}

export function reduce(state: AppState, action: Action): Reduction {
  switch (action.type) {
    case 'move':
      return applyUserMoves(state, [action.move], state.moveMs);
    case 'rotate': {
      const orientation = applyRotation(state.orientation, action.rotation);
      return {
        next: { ...state, orientation },
        effects: [{ type: 'animate', turnable: action.rotation, state: state.cube, orientation, durationMs: state.moveMs }],
      };
    }
    case 'scramble': {
      const result = applyUserMoves(state, action.moves, SCRAMBLE_MOVE_MS);
      return { next: result.next, effects: [...result.effects, { type: 'log', text: `Scrambled: ${formatNotation(action.moves)}` }] };
    }
    case 'reset': {
      const next: AppState = { ...initialState(), moveMs: state.moveMs };
      return {
        next,
        effects: [
          { type: 'highlight', facelets: [] },
          { type: 'log', text: 'Reset' },
          { type: 'snap', state: next.cube, orientation: next.orientation },
          { type: 'resetCamera' },
        ],
      };
    }
    case 'undo': {
      const last = state.history.at(-1);
      if (last === undefined) {
        return { next: state, effects: [{ type: 'log', text: 'Nothing to undo' }] };
      }
      const discarded = discardSolution(state);
      const inverse = invert([last]);
      const animated = animateMoves(discarded.next, inverse, discarded.next.moveMs);
      return {
        next: { ...discarded.next, cube: animated.cube, history: discarded.next.history.slice(0, -1) },
        effects: [...discarded.effects, ...animated.effects],
      };
    }
    case 'solutionReady': {
      const moveCount = action.solution.steps.reduce((sum, step) => sum + step.moves.length, 0);
      const loaded: AppState = { ...state, solution: action.solution, stepIndex: 0, solveMode: action.mode };
      const log: Effect = {
        type: 'log',
        text: `${action.solution.method} solution: ${action.solution.steps.length} steps, ${moveCount} moves`,
      };
      if (action.mode === 'teach') return { next: loaded, effects: [log] };
      const first = stepNext(loaded);
      return { next: first.next, effects: [log, ...first.effects] };
    }
    case 'stepNext':
      return stepNext(state);
    case 'playAll': {
      if (state.solution === null) return { next: state, effects: [{ type: 'log', text: 'No solution loaded' }] };
      return stepNext({ ...state, solveMode: 'playing' });
    }
    case 'stop':
      return { next: { ...state, solveMode: state.solution === null ? 'idle' : 'teach' }, effects: [] };
    case 'animationsIdle':
      return state.solveMode === 'playing' ? stepNext(state) : { next: state, effects: [] };
    case 'setMoveMs':
      return { next: { ...state, moveMs: action.ms }, effects: [] };
    case 'skipStage':
      return skipStage(state);
    case 'highlightCurrentStep': {
      const step = state.solution?.steps[state.stepIndex];
      return { next: state, effects: [{ type: 'highlight', facelets: step === undefined ? [] : step.targetFacelets }] };
    }
  }
}
