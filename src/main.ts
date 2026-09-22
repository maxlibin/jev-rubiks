import './ui/panel.css';
import { createCoach } from './app/coach';
import { runEffects } from './app/effects';
import { initialState, reduce, type Action, type AppState } from './app/state';
import { randomScramble } from './cube/scramble';
import { createBrowserJevClient } from './jev/client';
import { createScene } from './scene/index';
import { solveBeginner } from './solver/beginner/index';
import { createKociembaClient } from './solver/kociembaClient';
import { createPanel } from './ui/panel';
import { createRotateOverlay } from './ui/rotateOverlay';

function required(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`index.html is missing #${id}`);
  return node;
}

let state: AppState = initialState();

const kociemba = createKociembaClient();
const jev = createBrowserJevClient();

const scene = createScene(required('scene'), {
  onUserMove: (move) => dispatch({ type: 'move', move }),
});
createRotateOverlay(required('scene'), (rotation) => dispatch({ type: 'rotate', rotation }));

const panel = createPanel(required('panel'), {
  onScramble: () => dispatch({ type: 'scramble', moves: randomScramble(25, Math.random) }),
  onReset: () => dispatch({ type: 'reset' }),
  onUndo: () => dispatch({ type: 'undo' }),
  onSolveFast: () => solveFast(),
  onSolveTeach: () => solveTeach(),
  onStepNext: () => dispatch({ type: 'stepNext' }),
  onPlayAll: () => dispatch({ type: 'playAll' }),
  onStop: () => dispatch({ type: 'stop' }),
});

function solveFast(): void {
  if (scene.isBusy()) {
    panel.log('Wait for the current animation to finish');
    return;
  }
  panel.setStatus('solving (kociemba)…');
  const started = performance.now();
  kociemba
    .solve(state.cube)
    .then((solution) => {
      panel.setStatus(`kociemba: ${Math.round(performance.now() - started)} ms`);
      dispatch({ type: 'solutionReady', solution, mode: 'playing' });
    })
    .catch((error: unknown) => {
      panel.setStatus('idle');
      panel.logError(error instanceof Error ? error.message : String(error));
    });
}

function solveTeach(): void {
  if (scene.isBusy()) {
    panel.log('Wait for the current animation to finish');
    return;
  }
  try {
    const started = performance.now();
    const solution = solveBeginner(state.cube);
    panel.setStatus(`beginner: ${Math.round(performance.now() - started)} ms`);
    dispatch({ type: 'solutionReady', solution, mode: 'teach' });
  } catch (error: unknown) {
    panel.logError(error instanceof Error ? error.message : String(error));
  }
}

const coach = createCoach({ jev, kociemba, panel, getState: () => state, dispatch, now: () => performance.now() });

function dispatch(action: Action): void {
  const before = state.cube;
  const { next, effects } = reduce(state, action);
  state = next;
  runEffects(effects, { scene, panel });
  panel.render(state);
  if (action.type === 'move') coach.onUserMove(before, action.move, state.cube);
  else if (state.cube !== before) coach.invalidate();
}

scene.onIdle(() => dispatch({ type: 'animationsIdle' }));
panel.render(state);

// Dev-only hook for browser tests and demos: where a sticker is on screen.
if (import.meta.env.DEV) {
  Object.assign(window, { jevRubik: { projectFacelet: scene.projectFacelet } });
}

