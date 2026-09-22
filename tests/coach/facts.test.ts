import { describe, expect, it } from 'vitest';
import { applyMove, applyMoves, solvedState } from '../../src/cube/state';
import { algorithm } from '../../src/solver/beginner/pieces';
import {
  computeFacts,
  currentStage,
  describeBreakage,
  describeMilestoneReached,
  initialHistory,
  milestones,
  progressScore,
  stageProgressText,
} from '../../src/coach/facts';

describe('milestones', () => {
  it('reads 4 everywhere on a solved cube and names the stage solved', () => {
    const m = milestones(solvedState());
    expect(m).toEqual({
      whiteEdges: 4,
      whiteCorners: 4,
      middleEdges: 4,
      yellowCrossEdges: 4,
      yellowFaceCorners: 4,
      yellowCornersPlaced: 4,
      yellowEdgesPlaced: 4,
    });
    expect(currentStage(m)).toBe('solved');
    expect(progressScore(m, 'solved')).toBe(28);
    expect(progressScore(m, 'white cross')).toBe(4);
  });

  it('after R the white cross has lost one edge and that is the current stage', () => {
    const m = milestones(applyMove(solvedState(), { face: 'R', turns: 1 }));
    expect(m.whiteEdges).toBe(3);
    expect(m.whiteCorners).toBe(2);
    expect(currentStage(m)).toBe('white cross');
    expect(stageProgressText(m, 'white cross')).toBe('3 of 4 white edges placed');
  });

  it('a U turn on a solved cube keeps two layers and only disturbs the top', () => {
    const m = milestones(applyMove(solvedState(), { face: 'U', turns: 1 }));
    expect(m.whiteEdges).toBe(4);
    expect(m.middleEdges).toBe(4);
    expect(m.yellowFaceCorners).toBe(4);
    expect(m.yellowCornersPlaced).toBe(0);
    expect(currentStage(m)).toBe('yellow corners');
  });
});

describe('breakage and milestones', () => {
  it('describes a finished cross being broken and a cross being completed', () => {
    const solved = milestones(solvedState());
    const afterR = milestones(applyMove(solvedState(), { face: 'R', turns: 1 }));
    expect(describeBreakage(solved, afterR)).toBe('the finished white cross went from 4 to 3 white edges placed');
    expect(describeMilestoneReached(afterR, solved)).toBe('white cross completed');
    expect(describeBreakage(afterR, solved)).toBeNull();
    expect(describeMilestoneReached(solved, afterR)).toBeNull();
  });

  it('ignores incidental later-stage counters while an earlier stage is being solved', () => {
    const scrambled = milestones(applyMoves(solvedState(), algorithm("F R U R' U' F' D L2")));
    expect(currentStage(scrambled)).toBe('white cross');
    // Losing a chance yellow-cross edge is not breakage while the white cross is the job.
    const later = { ...scrambled, yellowCrossEdges: Math.max(0, scrambled.yellowCrossEdges - 1) };
    expect(describeBreakage(scrambled, later)).toBeNull();
    // Completing a later stage by chance is not a milestone either.
    expect(describeMilestoneReached(scrambled, { ...scrambled, yellowCrossEdges: 4 })).toBeNull();
  });
});

describe('computeFacts', () => {
  it('tracks effect, streak and time since progress across moves', () => {
    const start = applyMoves(solvedState(), algorithm("R U R' U'"));
    const after1 = applyMove(start, { face: 'F', turns: 1 });
    const first = computeFacts({
      before: start,
      after: after1,
      move: { face: 'F', turns: 1 },
      distanceBefore: 4,
      distanceAfter: 5,
      history: initialHistory(0),
      nowMs: 10_000,
    });
    expect(first.facts.lastMove).toBe('F');
    expect(first.facts.lastMoveEffect).toBe('further');
    expect(first.facts.unproductiveStreak).toBe(1);
    expect(first.facts.secondsSinceProgress).toBe(10);
    expect(first.facts.brokeProgress).not.toBeNull();

    const second = computeFacts({
      before: after1,
      after: start,
      move: { face: 'F', turns: 3 },
      distanceBefore: 5,
      distanceAfter: 4,
      history: first.history,
      nowMs: 15_000,
    });
    expect(second.facts.lastMoveEffect).toBe('closer');
    // The streak resets because the cross was rebuilt (a milestone gain), not because the distance fell.
    expect(second.facts.unproductiveStreak).toBe(0);
    expect(second.facts.secondsSinceProgress).toBe(0);
    expect(second.facts.movesSinceCoachSpoke).toBe(101);
  });

  it('does not count a lower solver distance as progress', () => {
    const start = applyMoves(solvedState(), algorithm("R U R' U' F"));
    const after = applyMove(start, { face: 'U', turns: 1 });
    const result = computeFacts({ before: start, after, move: { face: 'U', turns: 1 }, distanceBefore: 6, distanceAfter: 5, history: initialHistory(0), nowMs: 5_000 });
    expect(result.facts.lastMoveEffect).toBe('closer');
    expect(result.facts.unproductiveStreak).toBe(1);
  });
});
