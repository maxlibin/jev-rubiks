import { APIError, type TypeSafeClient } from '@typesafe-ai/sdk';
import { computeFacts, initialHistory, markCoachSpoke, type CoachHistory } from '../coach/facts';
import { coachMessage } from '../coach/messages';
import { buildCoachQuestions, buildCoachState, interpretCoachAnswers } from '../coach/questions';
import type { CubeState, Move } from '../cube/types';
import { THRESHOLDS } from '../jev/thresholds';
import { solveBeginner } from '../solver/beginner/index';
import type { KociembaClient } from '../solver/kociembaClient';
import type { SolveStep } from '../solver/types';
import type { PanelApi } from '../ui/panel';
import type { Action, AppState } from './state';

export type CoachDeps = {
  readonly jev: TypeSafeClient;
  readonly kociemba: KociembaClient;
  readonly panel: PanelApi;
  getState(): AppState;
  dispatch(action: Action): void;
  now(): number;
};

export type Coach = {
  /** Called after the reducer applied a move the user made by hand. */
  onUserMove(before: CubeState, move: Move, after: CubeState): void;
  /** Called when the cube changed by other means (scramble, reset, solver, undo). */
  invalidate(): void;
};

function nextBeginnerStep(state: CubeState): SolveStep | null {
  return solveBeginner(state).steps[0] ?? null;
}

/**
 * Watches the user's manual moves. Code computes the facts (stage, effect,
 * breakage, streak); Jev judges whether to speak, what kind of message fits,
 * and whether to offer a demo. Moves are processed strictly in order.
 */
export function createCoach(deps: CoachDeps): Coach {
  let history: CoachHistory = initialHistory(deps.now());
  let knownDistance: { readonly cube: CubeState; readonly distance: number } | null = null;
  let queue: Promise<void> = Promise.resolve();

  const distanceOf = async (cube: CubeState): Promise<number> => {
    if (knownDistance !== null && knownDistance.cube === cube) return knownDistance.distance;
    return deps.kociemba.distance(cube);
  };

  const handle = async (before: CubeState, move: Move, after: CubeState): Promise<void> => {
    const distanceBefore = await distanceOf(before);
    const distanceAfter = await deps.kociemba.distance(after);
    knownDistance = { cube: after, distance: distanceAfter };
    const computed = computeFacts({ before, after, move, distanceBefore, distanceAfter, history, nowMs: deps.now() });
    history = computed.history;
    const facts = computed.facts;
    deps.panel.coachFacts(`${facts.lastMove}: ${facts.lastMoveEffect} (distance ${facts.distance}) · ${facts.stage}: ${facts.stageProgress}`);

    const started = performance.now();
    const { data, requestId } = await deps.jev
      .systemOne({ state: buildCoachState(facts), questions: buildCoachQuestions() })
      .withResponse();
    deps.panel.setStatus(`jev ${Math.round(performance.now() - started)} ms · ${data.usage.input_tokens} tokens · ${requestId ?? 'no request id'}`);
    const decision = interpretCoachAnswers(data.answers, facts, THRESHOLDS);
    deps.panel.coachJudgment(decision.judgment);

    if (decision.speak) {
      const nextStep = decision.kind === 'help_stuck' ? nextBeginnerStep(after) : null;
      deps.panel.coachSay(coachMessage(decision.kind, facts, nextStep));
      history = markCoachSpoke(history);
    }
    if (decision.offerDemo && !facts.solved) {
      deps.panel.coachOffer(() => {
        const current = deps.getState();
        deps.dispatch({ type: 'solutionReady', solution: solveBeginner(current.cube), mode: 'teach' });
        deps.dispatch({ type: 'stepNext' });
      });
    } else {
      deps.panel.coachClearOffer();
    }
  };

  return {
    onUserMove(before, move, after) {
      queue = queue
        .then(() => handle(before, move, after))
        .catch((error: unknown) => {
          if (error instanceof APIError) {
            const body = error.body === undefined || error.body === null ? '' : ` body ${JSON.stringify(error.body)}`;
            deps.panel.logError(`Coach: ${error.message} (status ${error.status}, request ${error.requestId ?? 'unknown'})${body}`);
            return;
          }
          deps.panel.logError(`Coach: ${error instanceof Error ? error.message : String(error)}`);
        });
    },
    invalidate() {
      knownDistance = null;
      history = initialHistory(deps.now());
      deps.panel.coachClearOffer();
    },
  };
}
