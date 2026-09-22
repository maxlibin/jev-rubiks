import { describe, expect, it } from 'vitest';
import { invert } from '../src/cube/notation';
import { randomScramble, seededRng } from '../src/cube/scramble';
import { applyMoves, isSolved, solvedState } from '../src/cube/state';
import type { Move } from '../src/cube/types';
import { initialState, reduce, type Action, type AppState, type Effect } from '../src/app/state';
import type { Solution } from '../src/solver/types';

function run(actions: readonly Action[]): { state: AppState; effects: Effect[] } {
  let state = initialState();
  const effects: Effect[] = [];
  for (const action of actions) {
    const result = reduce(state, action);
    state = result.next;
    effects.push(...result.effects);
  }
  return { state, effects };
}

const R: Move = { face: 'R', turns: 1 };

describe('reducer', () => {
  it('a move updates the cube, records history and emits one animate effect', () => {
    const { state, effects } = run([{ type: 'move', move: R }]);
    expect(state.history).toEqual([R]);
    expect(isSolved(state.cube)).toBe(false);
    const animate = effects.filter((e) => e.type === 'animate');
    expect(animate).toHaveLength(1);
    expect(animate[0]).toMatchObject({ turnable: R, state: state.cube, durationMs: 180 });
  });

  it('scramble then undo for every move returns to the pre-scramble state', () => {
    const scramble = randomScramble(12, seededRng(5));
    const before = run([{ type: 'move', move: R }]).state;
    const actions: Action[] = [{ type: 'move', move: R }, { type: 'scramble', moves: scramble }];
    for (let i = 0; i < scramble.length; i += 1) actions.push({ type: 'undo' });
    const { state, effects } = run(actions);
    expect(state.cube).toEqual(before.cube);
    expect(state.history).toEqual([R]);
    const scrambleAnimations = effects.filter((e) => e.type === 'animate' && e.durationMs === 60);
    expect(scrambleAnimations).toHaveLength(scramble.length);
  });

  it('undo on an empty history logs and changes nothing', () => {
    const { state, effects } = run([{ type: 'undo' }]);
    expect(state).toEqual(initialState());
    expect(effects).toEqual([{ type: 'log', text: 'Nothing to undo' }]);
  });

  it('reset snaps to solved, clears history and resets the camera', () => {
    const { state, effects } = run([{ type: 'move', move: R }, { type: 'rotate', rotation: { axis: 'y', turns: 1 } }, { type: 'reset' }]);
    expect(isSolved(state.cube)).toBe(true);
    expect(state.orientation).toEqual({ up: 'U', front: 'F', right: 'R' });
    expect(state.history).toEqual([]);
    expect(effects.at(-2)).toEqual({ type: 'snap', state: state.cube, orientation: state.orientation });
    expect(effects.at(-1)).toEqual({ type: 'resetCamera' });
  });

  it('stepNext applies exactly that step, highlights its targets and advances', () => {
    const scrambled = applyMoves(solvedState(), [R]);
    const solution: Solution = {
      method: 'beginner',
      steps: [{ stage: 'white_cross', moves: invert([R]), targetFacelets: [27, 28], note: 'undo R' }],
    };
    const { state, effects } = run([
      { type: 'move', move: R },
      { type: 'solutionReady', solution, mode: 'teach' },
      { type: 'stepNext' },
    ]);
    expect(state.cube).toEqual(applyMoves(scrambled, invert([R])));
    expect(state.stepIndex).toBe(1);
    expect(effects.filter((e) => e.type === 'highlight').at(-1)).toEqual({ type: 'highlight', facelets: [27, 28] });
    const stepAnimations = effects.filter((e) => e.type === 'animate').slice(1);
    expect(stepAnimations.map((e) => (e.type === 'animate' ? e.turnable : null))).toEqual(invert([R]));
  });

  it('a user move during teach mode discards the solution', () => {
    const solution: Solution = { method: 'kociemba', steps: [{ stage: 'optimal', moves: [R], targetFacelets: [], note: 'x' }] };
    const { state } = run([{ type: 'solutionReady', solution, mode: 'teach' }, { type: 'move', move: R }]);
    expect(state.solution).toBeNull();
    expect(state.solveMode).toBe('idle');
  });

  it('playing mode advances a step on each animationsIdle until done', () => {
    const solution: Solution = {
      method: 'beginner',
      steps: [
        { stage: 'white_cross', moves: [R], targetFacelets: [], note: 'one' },
        { stage: 'white_cross', moves: [R], targetFacelets: [], note: 'two' },
      ],
    };
    const { state } = run([
      { type: 'solutionReady', solution, mode: 'playing' },
      { type: 'animationsIdle' },
      { type: 'animationsIdle' },
    ]);
    expect(state.stepIndex).toBe(2);
    expect(state.solveMode).toBe('idle');
    expect(state.history).toEqual([R, R]);
  });

  it('stop leaves playing mode at the next step boundary', () => {
    const solution: Solution = {
      method: 'beginner',
      steps: [
        { stage: 'white_cross', moves: [R], targetFacelets: [], note: 'one' },
        { stage: 'white_cross', moves: [R], targetFacelets: [], note: 'two' },
      ],
    };
    const { state } = run([{ type: 'solutionReady', solution, mode: 'playing' }, { type: 'stop' }, { type: 'animationsIdle' }]);
    expect(state.stepIndex).toBe(1);
    expect(state.solveMode).toBe('teach');
  });
});

describe('skipStage and highlightCurrentStep', () => {
  const solution: Solution = {
    method: 'beginner',
    steps: [
      { stage: 'white_cross', moves: [R], targetFacelets: [1], note: 'a' },
      { stage: 'white_cross', moves: [R], targetFacelets: [2], note: 'b' },
      { stage: 'white_corners', moves: [R], targetFacelets: [3], note: 'c' },
    ],
  };

  it('skipStage plays the remaining steps of the current stage only', () => {
    const { state, effects } = run([{ type: 'solutionReady', solution, mode: 'teach' }, { type: 'skipStage' }]);
    expect(state.stepIndex).toBe(2);
    expect(state.history).toEqual([R, R]);
    expect(effects.filter((e) => e.type === 'animate')).toHaveLength(2);
  });

  it('highlightCurrentStep emits the current step targets', () => {
    const { effects } = run([{ type: 'solutionReady', solution, mode: 'teach' }, { type: 'highlightCurrentStep' }]);
    expect(effects.at(-1)).toEqual({ type: 'highlight', facelets: [1] });
  });
});
