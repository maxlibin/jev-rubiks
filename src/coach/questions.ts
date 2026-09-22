import { choice, noul } from '@typesafe-ai/sdk';
import type { Thresholds } from '../jev/thresholds';
import type { CoachFacts } from './facts';

export const MESSAGE_KINDS = ['celebrate_milestone', 'warn_broke_progress', 'help_stuck', 'explain_stage_goal', 'nothing'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Jev reads numbers unreliably, so counts and durations are sent as words. */
export function describeStreak(moves: number): string {
  if (moves === 0) return 'none: the last move placed a piece';
  if (moves <= 5) return `${moves} without placing a piece, which is normal in the middle of an algorithm`;
  if (moves <= 9) return `${moves} in a row without placing a piece: longer than one algorithm`;
  return `${moves} in a row without placing a piece: a long time`;
}

export function describeStuckTime(seconds: number): string {
  if (seconds < 20) return 'just now';
  if (seconds < 60) return 'under a minute ago';
  if (seconds < 180) return 'a few minutes ago';
  return 'a long time ago';
}

export function describeSinceSpoke(moves: number): string {
  if (moves <= 1) return 'the coach spoke a moment ago';
  if (moves <= 3) return 'the coach spoke a few moves ago';
  if (moves <= 8) return 'the coach has been quiet for several moves';
  return 'the coach has been quiet for a long time';
}

export type CoachState = {
  readonly situation: {
    readonly stage: string;
    readonly stage_progress: string;
    readonly last_move: string;
    readonly undid_earlier_work: string;
    readonly milestone_just_reached: string;
    readonly moves_without_progress: string;
    readonly last_progress_was: string;
    readonly coach_silence: string;
    readonly cube_is_solved: boolean;
  };
};

export function buildCoachState(facts: CoachFacts): CoachState {
  return {
    situation: {
      stage: facts.stage,
      stage_progress: facts.stageProgress,
      last_move: facts.lastMove,
      undid_earlier_work: facts.brokeProgress === null ? 'no' : `yes: ${facts.brokeProgress}`,
      milestone_just_reached: facts.milestoneReached === null ? 'no' : `yes: ${facts.milestoneReached}`,
      moves_without_progress: describeStreak(facts.unproductiveStreak),
      last_progress_was: describeStuckTime(facts.secondsSinceProgress),
      coach_silence: describeSinceSpoke(facts.movesSinceCoachSpoke),
      cube_is_solved: facts.solved,
    },
  };
}

const MESSAGE_KIND_CRITERIA: Readonly<Record<MessageKind, string>> = {
  celebrate_milestone: 'a milestone was just reached (`situation.milestone_just_reached` is yes) or the cube is solved',
  warn_broke_progress: 'the last move undid earlier work (`situation.undid_earlier_work` is yes) and the person should know',
  help_stuck: 'the person has gone longer than one algorithm without progress; remind them of the stage goal and offer the exact next step',
  explain_stage_goal: 'a new stage just started or they seem unsure what to do next; explain the goal of the current stage',
  nothing: 'nothing needs saying: they are making progress, or the coach spoke a moment ago',
};

export function buildCoachQuestions() {
  return {
    should_speak: noul(
      'Should a solving coach say something right now, rather than stay quiet? Speak when the person just undid their own earlier work, when they reached a milestone, when the cube is solved, or when they have gone longer than one algorithm without progress. Stay quiet while they are making progress, stay quiet during the first few moves without progress (algorithms take several moves), and stay quiet if the coach spoke a moment ago unless they just broke something.',
    ),
    message_kind: choice('If the coach speaks, which kind of message fits `situation` best?', MESSAGE_KIND_CRITERIA),
    offer_demo: noul(
      'Would it help this person right now to offer a button that shows the next step on the cube? Yes when they are stuck for many moves or a long time; no when they are progressing or just started a stage.',
    ),
  };
}

export type CoachAnswers = {
  readonly should_speak: { readonly noul: number };
  readonly message_kind: { readonly choice: MessageKind; readonly confidence: number };
  readonly offer_demo: { readonly noul: number };
};

export type CoachDecision = {
  readonly speak: boolean;
  readonly kind: MessageKind;
  readonly offerDemo: boolean;
  /** One line showing Jev's raw judgment, for the panel. */
  readonly judgment: string;
};

const STUCK_KINDS: readonly MessageKind[] = ['help_stuck'];

/** Code-owned policy on top of Jev's judgment: confidence gates and a minimum streak for "stuck" messages. */
export function interpretCoachAnswers(answers: CoachAnswers, facts: CoachFacts, thresholds: Thresholds): CoachDecision {
  const kind = answers.message_kind.choice;
  const stuckAllowed = facts.unproductiveStreak >= thresholds.stuckStreak;
  const speak =
    answers.should_speak.noul >= thresholds.speak &&
    answers.message_kind.confidence >= thresholds.kind &&
    kind !== 'nothing' &&
    (stuckAllowed || !STUCK_KINDS.includes(kind));
  const offerDemo = answers.offer_demo.noul >= thresholds.offerDemo && stuckAllowed;
  return {
    speak,
    kind,
    offerDemo,
    judgment: `speak ${answers.should_speak.noul.toFixed(2)} · ${answers.message_kind.choice} (${answers.message_kind.confidence.toFixed(2)}) · offer demo ${answers.offer_demo.noul.toFixed(2)}`,
  };
}
