import type { Move } from '../cube/types';

export type Stage =
  | 'white_cross'
  | 'white_corners'
  | 'middle_edges'
  | 'yellow_cross'
  | 'yellow_face'
  | 'yellow_corners'
  | 'yellow_edges'
  | 'optimal';

export type SolveStep = {
  readonly stage: Stage;
  readonly moves: readonly Move[];
  /** Facelet indices this step places; the scene highlights them during playback. */
  readonly targetFacelets: readonly number[];
  readonly note: string;
};

export type Solution = {
  readonly method: 'beginner' | 'kociemba';
  readonly steps: readonly SolveStep[];
};

export class SolverStuckError extends Error {
  constructor(stage: Stage, facelets: string, detail: string) {
    super(`Solver stuck in stage ${stage} (${detail}); facelets=${facelets}`);
    this.name = 'SolverStuckError';
  }
}
