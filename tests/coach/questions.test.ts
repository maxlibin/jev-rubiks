import { describe, expect, it } from 'vitest';
import type { CoachFacts } from '../../src/coach/facts';
import { coachMessage } from '../../src/coach/messages';
import { buildCoachQuestions, buildCoachState, describeStreak, interpretCoachAnswers } from '../../src/coach/questions';
import { THRESHOLDS } from '../../src/jev/thresholds';

const facts: CoachFacts = {
  stage: 'white cross',
  stageProgress: '3 of 4 white edges placed',
  lastMove: "R'",
  lastMoveEffect: 'further',
  distance: 17,
  brokeProgress: 'the finished white cross went from 4 to 3 white edges placed',
  milestoneReached: null,
  unproductiveStreak: 5,
  secondsSinceProgress: 90,
  movesSinceCoachSpoke: 7,
  solved: false,
};

describe('coach state for Jev', () => {
  it('describes counts as words and carries every fact', () => {
    expect(buildCoachState(facts)).toEqual({
      situation: {
        stage: 'white cross',
        stage_progress: '3 of 4 white edges placed',
        last_move: "R'",
        undid_earlier_work: 'yes: the finished white cross went from 4 to 3 white edges placed',
        milestone_just_reached: 'no',
        moves_without_progress: '5 without placing a piece, which is normal in the middle of an algorithm',
        last_progress_was: 'a few minutes ago',
        coach_silence: 'the coach has been quiet for several moves',
        cube_is_solved: false,
      },
    });
    expect(describeStreak(0)).toContain('placed a piece');
    expect(Object.keys(buildCoachQuestions())).toEqual(['should_speak', 'message_kind', 'offer_demo']);
  });
});

describe('interpretCoachAnswers', () => {
  it('speaks above the threshold with the chosen kind and offers a demo', () => {
    const decision = interpretCoachAnswers(
      { should_speak: { noul: 0.8 }, message_kind: { choice: 'warn_broke_progress', confidence: 0.9 }, offer_demo: { noul: 0.6 } },
      { ...facts, unproductiveStreak: 9 },
      THRESHOLDS,
    );
    expect(decision).toMatchObject({ speak: true, kind: 'warn_broke_progress', offerDemo: true });
    expect(decision.judgment).toBe('speak 0.80 · warn_broke_progress (0.90) · offer demo 0.60');
  });

  it('stays quiet below the threshold or when the kind is nothing', () => {
    expect(
      interpretCoachAnswers({ should_speak: { noul: 0.2 }, message_kind: { choice: 'help_stuck', confidence: 0.5 }, offer_demo: { noul: 0.1 } }, facts, THRESHOLDS).speak,
    ).toBe(false);
    expect(
      interpretCoachAnswers({ should_speak: { noul: 0.9 }, message_kind: { choice: 'nothing', confidence: 0.9 }, offer_demo: { noul: 0.1 } }, facts, THRESHOLDS).speak,
    ).toBe(false);
  });

  it('never nudges or offers a demo before the stuck streak, and ignores low-confidence kinds', () => {
    const early = { ...facts, unproductiveStreak: 5 };
    const stuck = { ...facts, unproductiveStreak: 9 };
    const answers = { should_speak: { noul: 0.9 }, message_kind: { choice: 'help_stuck' as const, confidence: 0.9 }, offer_demo: { noul: 0.9 } };
    expect(interpretCoachAnswers(answers, early, THRESHOLDS)).toMatchObject({ speak: false, offerDemo: false });
    expect(interpretCoachAnswers(answers, stuck, THRESHOLDS)).toMatchObject({ speak: true, offerDemo: true });
    const vague = { ...answers, message_kind: { choice: 'explain_stage_goal' as const, confidence: 0.3 } };
    expect(interpretCoachAnswers(vague, stuck, THRESHOLDS).speak).toBe(false);
  });
});

describe('coachMessage', () => {
  it('fills the templates with facts', () => {
    expect(coachMessage('warn_broke_progress', facts, null)).toContain("R' undid earlier work");
    expect(coachMessage('help_stuck', facts, null)).toContain('5 moves without getting closer');
    expect(coachMessage('help_stuck', facts, { stage: 'white_cross', moves: [{ face: 'F', turns: 2 }], targetFacelets: [], note: 'Place the white-green edge' })).toContain('F2');
    expect(coachMessage('celebrate_milestone', { ...facts, solved: true }, null)).toContain('Solved');
    expect(coachMessage('nothing', facts, null)).toBe('');
  });
});
