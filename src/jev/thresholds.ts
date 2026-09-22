/**
 * Decision thresholds for jev-1.13.0, tuned on tests/coach.live.test.ts.
 * `speak`: minimum Noul probability before the coach says anything.
 * `kind`: minimum Choice confidence in the message kind before acting on it.
 * `offerDemo`: minimum Noul probability before the "Show me" button appears.
 * `stuckStreak`: moves without placing a piece before "stuck" messages are allowed;
 * beginner algorithms run up to ~8 moves whose middle steps never look like progress.
 */
export type Thresholds = {
  readonly speak: number;
  readonly kind: number;
  readonly offerDemo: number;
  readonly stuckStreak: number;
};

export const THRESHOLDS: Thresholds = { speak: 0.5, kind: 0.5, offerDemo: 0.5, stuckStreak: 8 };
