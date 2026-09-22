import { faceletColor, isSolved } from '../cube/state';
import type { CubeState, Move } from '../cube/types';
import { formatNotation } from '../cube/notation';
import { CORNER_SLOTS, D_CORNER_OF, D_EDGE_OF, EDGE_SLOTS, isPlaced, MIDDLE_EDGE_OF, SIDES } from '../solver/beginner/pieces';

/** How many pieces each beginner-method milestone has in place (each out of 4). */
export type Milestones = {
  readonly whiteEdges: number;
  readonly whiteCorners: number;
  readonly middleEdges: number;
  readonly yellowCrossEdges: number;
  readonly yellowFaceCorners: number;
  readonly yellowCornersPlaced: number;
  readonly yellowEdgesPlaced: number;
};

export const STAGE_NAMES = [
  'white cross',
  'white corners',
  'middle edges',
  'yellow cross',
  'yellow face',
  'yellow corners',
  'yellow edges',
  'solved',
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

const U_EDGE_FACELETS = [1, 3, 5, 7] as const;
const U_CORNER_FACELETS = [0, 2, 6, 8] as const;
const U_CORNER_SLOTS = ['URF', 'UFL', 'ULB', 'UBR'] as const;
const U_EDGE_SLOTS = ['UR', 'UF', 'UL', 'UB'] as const;

function count(items: readonly boolean[]): number {
  return items.filter(Boolean).length;
}

export function milestones(state: CubeState): Milestones {
  return {
    whiteEdges: count(SIDES.map((side) => isPlaced(state, EDGE_SLOTS[D_EDGE_OF[side]]))),
    whiteCorners: count(SIDES.map((side) => isPlaced(state, CORNER_SLOTS[D_CORNER_OF[side]]))),
    middleEdges: count(SIDES.map((side) => isPlaced(state, EDGE_SLOTS[MIDDLE_EDGE_OF[side]]))),
    yellowCrossEdges: count(U_EDGE_FACELETS.map((index) => faceletColor(state, index) === 'yellow')),
    yellowFaceCorners: count(U_CORNER_FACELETS.map((index) => faceletColor(state, index) === 'yellow')),
    yellowCornersPlaced: count(U_CORNER_SLOTS.map((slot) => isPlaced(state, CORNER_SLOTS[slot]))),
    yellowEdgesPlaced: count(U_EDGE_SLOTS.map((slot) => isPlaced(state, EDGE_SLOTS[slot]))),
  };
}

/** The beginner-method stage the solver would work on next: the first milestone that is incomplete. */
export function currentStage(m: Milestones): StageName {
  if (m.whiteEdges < 4) return 'white cross';
  if (m.whiteCorners < 4) return 'white corners';
  if (m.middleEdges < 4) return 'middle edges';
  if (m.yellowCrossEdges < 4) return 'yellow cross';
  if (m.yellowFaceCorners < 4) return 'yellow face';
  if (m.yellowCornersPlaced < 4) return 'yellow corners';
  if (m.yellowEdgesPlaced < 4) return 'yellow edges';
  return 'solved';
}

const STAGE_COUNTER: Readonly<Record<Exclude<StageName, 'solved'>, { readonly key: keyof Milestones; readonly unit: string }>> = {
  'white cross': { key: 'whiteEdges', unit: 'white edges placed' },
  'white corners': { key: 'whiteCorners', unit: 'white corners placed' },
  'middle edges': { key: 'middleEdges', unit: 'middle edges placed' },
  'yellow cross': { key: 'yellowCrossEdges', unit: 'top edges showing yellow' },
  'yellow face': { key: 'yellowFaceCorners', unit: 'top corners showing yellow' },
  'yellow corners': { key: 'yellowCornersPlaced', unit: 'top corners in the right place' },
  'yellow edges': { key: 'yellowEdgesPlaced', unit: 'top edges in the right place' },
};

export function stageProgressText(m: Milestones, stage: StageName): string {
  if (stage === 'solved') return 'the cube is solved';
  const counter = STAGE_COUNTER[stage];
  return `${m[counter.key]} of 4 ${counter.unit}`;
}

type WorkStage = Exclude<StageName, 'solved'>;

const WORK_STAGES = STAGE_NAMES.filter((stage): stage is WorkStage => stage !== 'solved');

/**
 * Stages that count as earned work while `current` is being solved: every
 * earlier stage plus the current one. Later-stage counters are incidental
 * (a scramble often shows two yellow edges by chance) and are ignored.
 */
function relevantStages(current: StageName): readonly WorkStage[] {
  if (current === 'solved') return WORK_STAGES;
  return WORK_STAGES.slice(0, WORK_STAGES.indexOf(current) + 1);
}

/** Sum of the milestone counters that matter while working on `current`; a drop means earned work was undone. */
export function progressScore(m: Milestones, current: StageName): number {
  return relevantStages(current).reduce((sum, stage) => sum + m[STAGE_COUNTER[stage].key], 0);
}

/** Names the first relevant milestone that lost pieces between two states, or null. */
export function describeBreakage(before: Milestones, after: Milestones): string | null {
  for (const stage of relevantStages(currentStage(before))) {
    const counter = STAGE_COUNTER[stage];
    const wasComplete = before[counter.key] === 4;
    if (after[counter.key] < before[counter.key]) {
      return `${wasComplete ? `the finished ${stage}` : `the ${stage}`} went from ${before[counter.key]} to ${after[counter.key]} ${counter.unit}`;
    }
  }
  return null;
}

/** Names the stage being worked on if it just became complete, or null. */
export function describeMilestoneReached(before: Milestones, after: Milestones): string | null {
  const stage = currentStage(before);
  if (stage === 'solved') return null;
  const counter = STAGE_COUNTER[stage];
  return before[counter.key] < 4 && after[counter.key] === 4 ? `${stage} completed` : null;
}

export type MoveEffect = 'closer' | 'further' | 'sideways';

/** Everything the coach knows about the situation after one user move. */
export type CoachFacts = {
  readonly stage: StageName;
  readonly stageProgress: string;
  readonly lastMove: string;
  readonly lastMoveEffect: MoveEffect;
  readonly distance: number;
  readonly brokeProgress: string | null;
  readonly milestoneReached: string | null;
  readonly unproductiveStreak: number;
  readonly secondsSinceProgress: number;
  readonly movesSinceCoachSpoke: number;
  readonly solved: boolean;
};

/** Rolling context the coach threads from move to move. */
export type CoachHistory = {
  readonly unproductiveStreak: number;
  readonly lastProgressAtMs: number;
  readonly movesSinceCoachSpoke: number;
};

export function initialHistory(nowMs: number): CoachHistory {
  return { unproductiveStreak: 0, lastProgressAtMs: nowMs, movesSinceCoachSpoke: 99 };
}

export type FactInput = {
  readonly before: CubeState;
  readonly after: CubeState;
  readonly move: Move;
  readonly distanceBefore: number;
  readonly distanceAfter: number;
  readonly history: CoachHistory;
  readonly nowMs: number;
};

export function computeFacts(input: FactInput): { readonly facts: CoachFacts; readonly history: CoachHistory } {
  const beforeMilestones = milestones(input.before);
  const afterMilestones = milestones(input.after);
  const effect: MoveEffect =
    input.distanceAfter < input.distanceBefore ? 'closer' : input.distanceAfter > input.distanceBefore ? 'further' : 'sideways';
  // Progress means an earned milestone gain. The optimal-solver distance moves ±1 with
  // aimless turns, so it is shown to the person but never counted as progress.
  const stageBefore = currentStage(beforeMilestones);
  const progressed = progressScore(afterMilestones, stageBefore) > progressScore(beforeMilestones, stageBefore);
  const history: CoachHistory = {
    unproductiveStreak: progressed ? 0 : input.history.unproductiveStreak + 1,
    lastProgressAtMs: progressed ? input.nowMs : input.history.lastProgressAtMs,
    movesSinceCoachSpoke: input.history.movesSinceCoachSpoke + 1,
  };
  const stage = currentStage(afterMilestones);
  return {
    facts: {
      stage,
      stageProgress: stageProgressText(afterMilestones, stage),
      lastMove: formatNotation([input.move]),
      lastMoveEffect: effect,
      distance: input.distanceAfter,
      brokeProgress: describeBreakage(beforeMilestones, afterMilestones),
      milestoneReached: describeMilestoneReached(beforeMilestones, afterMilestones),
      unproductiveStreak: history.unproductiveStreak,
      secondsSinceProgress: Math.round((input.nowMs - history.lastProgressAtMs) / 1000),
      movesSinceCoachSpoke: history.movesSinceCoachSpoke,
      solved: isSolved(input.after),
    },
    history,
  };
}

export function markCoachSpoke(history: CoachHistory): CoachHistory {
  return { ...history, movesSinceCoachSpoke: 0 };
}
