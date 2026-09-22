import { formatNotation } from '../cube/notation';
import { toFaceletString } from '../cube/state';
import type { AppState } from '../app/state';

export type PanelHandlers = {
  onScramble(): void;
  onReset(): void;
  onUndo(): void;
  onSolveFast(): void;
  onSolveTeach(): void;
  onStepNext(): void;
  onPlayAll(): void;
  onStop(): void;
};

export type PanelApi = {
  render(state: AppState): void;
  log(text: string): void;
  logError(text: string): void;
  setStatus(text: string): void;
  /** The facts code computed for the last move. */
  coachFacts(text: string): void;
  /** Jev's raw judgment for the last move. */
  coachJudgment(text: string): void;
  coachSay(text: string): void;
  coachOffer(onPick: () => void): void;
  coachClearOffer(): void;
};

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>>,
  children: readonly (Node | string)[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function section(title: string, children: readonly Node[]): HTMLElement {
  return element('section', { class: 'section' }, [element('h2', {}, [title]), element('div', { class: 'section-body' }, children)]);
}

/** A "label — value" row for the status and coach cards. */
function labelled(label: string, value: HTMLElement): HTMLElement {
  return element('div', { class: 'kv' }, [element('span', { class: 'kv-label' }, [label]), value]);
}

function button(testId: string, label: string, onClick: () => void, className: string): HTMLButtonElement {
  const node = element('button', { 'data-testid': testId, class: className, type: 'button' }, [label]);
  node.addEventListener('click', onClick);
  return node;
}

export function createPanel(container: HTMLElement, handlers: PanelHandlers): PanelApi {
  const facelets = element('code', { class: 'facelets', 'data-testid': 'facelets' }, []);
  const historyCount = element('span', { class: 'kv-value', 'data-testid': 'history-count' }, ['0']);
  const status = element('span', { class: 'kv-value', 'data-testid': 'status' }, ['idle']);
  const log = element('div', { class: 'log', 'data-testid': 'log' }, []);
  const undo = button('undo', 'Undo', handlers.onUndo, '');
  const solveFast = button('solve-fast', 'Solve fast', handlers.onSolveFast, 'primary');
  const solveTeach = button('solve-teach', 'Teach me', handlers.onSolveTeach, 'primary');
  const stepNext = button('step-next', 'Next step', handlers.onStepNext, '');
  const playAll = button('step-play-all', 'Play all', handlers.onPlayAll, '');
  const stop = button('step-stop', 'Stop', handlers.onStop, '');
  const stepInfo = element('div', { class: 'step-info muted', 'data-testid': 'step-info' }, ['No solution loaded']);

  const coachLog = element('div', { class: 'coach-log', 'data-testid': 'coach-log' }, []);
  const coachFactsLine = element('span', { class: 'kv-value', 'data-testid': 'coach-facts' }, ['make a move by hand and the coach will watch']);
  const coachJudgmentLine = element('span', { class: 'kv-value mono', 'data-testid': 'coach-judgment' }, ['—']);
  const coachDemo = button('coach-demo', 'Show me', () => undefined, 'primary');
  coachDemo.hidden = true;
  let onDemo: (() => void) | null = null;
  coachDemo.addEventListener('click', () => {
    if (onDemo !== null) onDemo();
  });

  container.replaceChildren(
    section('Cube', [
      element('div', { class: 'row' }, [
        button('scramble', 'Scramble', handlers.onScramble, ''),
        button('reset', 'Reset', handlers.onReset, ''),
        undo,
      ]),
    ]),
    section('Solve', [
      element('div', { class: 'row' }, [solveTeach, solveFast]),
      stepInfo,
      element('div', { class: 'row' }, [stepNext, playAll, stop]),
    ]),
    section('Coach · Jev watches your moves', [
      coachLog,
      element('div', { class: 'kv-list' }, [labelled('Last move', coachFactsLine), labelled('Jev', coachJudgmentLine)]),
      element('div', { class: 'row' }, [coachDemo]),
    ]),
    section('Status', [
      element('div', { class: 'kv-list' }, [labelled('Solver', status), labelled('Moves in history', historyCount)]),
      element('details', { class: 'debug' }, [element('summary', {}, ['Facelets']), facelets]),
    ]),
    section('Log', [log]),
  );

  const append = (text: string, className: string): void => {
    const line = element('div', { class: className }, [text]);
    log.append(line);
    log.scrollTop = log.scrollHeight;
  };

  return {
    render(state) {
      facelets.textContent = toFaceletString(state.cube);
      historyCount.textContent = String(state.history.length);
      undo.disabled = state.history.length === 0;
      const solution = state.solution;
      const hasSteps = solution !== null && state.stepIndex < solution.steps.length;
      stepNext.disabled = !hasSteps || state.solveMode === 'playing';
      playAll.disabled = !hasSteps || state.solveMode === 'playing';
      stop.disabled = state.solveMode !== 'playing';
      if (solution === null) {
        stepInfo.textContent = 'No solution loaded';
      } else {
        const step = solution.steps[state.stepIndex];
        stepInfo.textContent =
          step === undefined
            ? `Done: ${solution.steps.length} steps`
            : `Step ${state.stepIndex + 1} of ${solution.steps.length} [${step.stage}] ${step.note} — ${formatNotation(step.moves)}`;
      }
    },
    log: (text) => append(text, ''),
    logError: (text) => append(text, 'error'),
    setStatus(text) {
      status.textContent = text;
    },
    coachFacts(text) {
      coachFactsLine.textContent = text;
    },
    coachJudgment(text) {
      coachJudgmentLine.textContent = text;
    },
    coachSay(text) {
      const line = element('div', { class: 'coach-message' }, [text]);
      coachLog.append(line);
      coachLog.scrollTop = coachLog.scrollHeight;
    },
    coachOffer(onPick) {
      onDemo = onPick;
      coachDemo.hidden = false;
    },
    coachClearOffer() {
      onDemo = null;
      coachDemo.hidden = true;
    },
  };
}
