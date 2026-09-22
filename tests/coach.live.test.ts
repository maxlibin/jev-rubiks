import { describe, expect, it } from 'vitest';
import type { CoachFacts } from '../src/coach/facts';
import { buildCoachQuestions, buildCoachState, interpretCoachAnswers, type CoachDecision, type MessageKind } from '../src/coach/questions';
import { createNodeJevClient } from '../src/jev/client';
import { THRESHOLDS } from '../src/jev/thresholds';

const client = createNodeJevClient();

const BASE: CoachFacts = {
  stage: 'white corners',
  stageProgress: '1 of 4 white corners placed',
  lastMove: 'R',
  lastMoveEffect: 'closer',
  distance: 14,
  brokeProgress: null,
  milestoneReached: null,
  unproductiveStreak: 0,
  secondsSinceProgress: 0,
  movesSinceCoachSpoke: 9,
  solved: false,
};

type Expectation = { readonly speak: boolean; readonly kinds: readonly MessageKind[]; readonly offerDemo: boolean | null };

async function judge(name: string, facts: CoachFacts): Promise<CoachDecision> {
  const { data } = await client.systemOne({ state: buildCoachState(facts), questions: buildCoachQuestions() }).withResponse();
  const decision = interpretCoachAnswers(data.answers, facts, THRESHOLDS);
  console.log(`${name.padEnd(34)} ${decision.judgment}`);
  return decision;
}

describe('jev-1.13.0 as the watching coach', () => {
  const cases: readonly [string, Partial<CoachFacts>, Expectation][] = [
    ['just placed a piece, quiet coach', {}, { speak: false, kinds: ['nothing'], offerDemo: false }],
    [
      'mid-algorithm, four moves without a piece, quiet coach',
      { lastMoveEffect: 'further', unproductiveStreak: 4, secondsSinceProgress: 15 },
      { speak: false, kinds: ['nothing'], offerDemo: false },
    ],
    [
      'broke the finished cross',
      { stage: 'white cross', stageProgress: '3 of 4 white edges placed', lastMoveEffect: 'further', brokeProgress: 'the finished white cross went from 4 to 3 white edges placed', unproductiveStreak: 1 },
      { speak: true, kinds: ['warn_broke_progress'], offerDemo: null },
    ],
    [
      'stuck for nine moves',
      { lastMoveEffect: 'sideways', unproductiveStreak: 9, secondsSinceProgress: 75 },
      { speak: true, kinds: ['help_stuck', 'explain_stage_goal'], offerDemo: null },
    ],
    [
      'stuck for a long time',
      { lastMoveEffect: 'further', unproductiveStreak: 14, secondsSinceProgress: 240 },
      { speak: true, kinds: ['help_stuck'], offerDemo: true },
    ],
    [
      'reached the white cross',
      { stage: 'white corners', stageProgress: '0 of 4 white corners placed', milestoneReached: 'white cross completed' },
      { speak: true, kinds: ['celebrate_milestone', 'explain_stage_goal'], offerDemo: false },
    ],
    [
      'solved',
      { stage: 'solved', stageProgress: 'the cube is solved', milestoneReached: 'yellow edges completed', solved: true, distance: 0 },
      { speak: true, kinds: ['celebrate_milestone'], offerDemo: false },
    ],
    [
      'coach just spoke, still progressing',
      { movesSinceCoachSpoke: 1 },
      { speak: false, kinds: ['nothing'], offerDemo: false },
    ],
    [
      'coach just spoke, but they broke the cross',
      { stage: 'white cross', stageProgress: '2 of 4 white edges placed', lastMoveEffect: 'further', brokeProgress: 'the finished white cross went from 4 to 2 white edges placed', movesSinceCoachSpoke: 1, unproductiveStreak: 1 },
      { speak: true, kinds: ['warn_broke_progress'], offerDemo: null },
    ],
  ];

  for (const [name, overrides, expected] of cases) {
    it(name, async () => {
      const decision = await judge(name, { ...BASE, ...overrides });
      expect(decision.speak).toBe(expected.speak);
      if (expected.speak) expect(expected.kinds).toContain(decision.kind);
      if (expected.offerDemo !== null) expect(decision.offerDemo).toBe(expected.offerDemo);
    });
  }
});
