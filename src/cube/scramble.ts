import { FACES, type Move, type Turns } from './types';

/** Returns a number in [0, 1). */
export type Rng = () => number;

/** mulberry32: small, fast, deterministic; good enough for scrambles and tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TURNS: readonly Turns[] = [1, 2, 3];

export function randomScramble(count: number, rng: Rng): readonly Move[] {
  const moves: Move[] = [];
  while (moves.length < count) {
    const face = FACES[Math.floor(rng() * FACES.length)];
    const turns = TURNS[Math.floor(rng() * TURNS.length)];
    if (face === undefined || turns === undefined) {
      throw new Error('rng returned a value outside [0, 1)');
    }
    const previous = moves[moves.length - 1];
    if (previous !== undefined && previous.face === face) {
      continue;
    }
    moves.push({ face, turns });
  }
  return moves;
}
