import type { Axis, Face, Move, Rotation, Turns } from './types';

export type Turnable = Move | Rotation;

export class NotationParseError extends Error {
  constructor(token: string, text: string) {
    super(`Unknown move token "${token}" in "${text}"`);
    this.name = 'NotationParseError';
  }
}

const FACE_TOKEN = /^([UDFBLR])(['2]?)$/;
const AXIS_TOKEN = /^([xyz])(['2]?)$/;

function suffixToTurns(suffix: string): Turns {
  if (suffix === "'") return 3;
  if (suffix === '2') return 2;
  return 1;
}

function turnsToSuffix(turns: Turns): string {
  if (turns === 3) return "'";
  if (turns === 2) return '2';
  return '';
}

function tokens(text: string): readonly string[] {
  return text.trim().split(/\s+/).filter((token) => token.length > 0);
}

export function isMove(item: Turnable): item is Move {
  return 'face' in item;
}

export function parseNotation(text: string): readonly Turnable[] {
  return tokens(text).map((token): Turnable => {
    const face = FACE_TOKEN.exec(token);
    if (face !== null) {
      return { face: face[1] as Face, turns: suffixToTurns(face[2] ?? '') };
    }
    const axis = AXIS_TOKEN.exec(token);
    if (axis !== null) {
      return { axis: axis[1] as Axis, turns: suffixToTurns(axis[2] ?? '') };
    }
    throw new NotationParseError(token, text);
  });
}

export function formatNotation(items: readonly Turnable[]): string {
  return items
    .map((item) => (isMove(item) ? item.face : item.axis) + turnsToSuffix(item.turns))
    .join(' ');
}

export function invert<T extends { readonly turns: Turns }>(items: readonly T[]): readonly T[] {
  return [...items].reverse().map((item) => ({ ...item, turns: item.turns === 2 ? 2 : item.turns === 1 ? 3 : 1 }));
}

export function isNotation(text: string): boolean {
  const list = tokens(text);
  return list.length > 0 && list.every((token) => FACE_TOKEN.test(token) || AXIS_TOKEN.test(token));
}

/** Merges consecutive moves on the same face and drops the ones that cancel out. */
export function simplifyMoves(moves: readonly Move[]): readonly Move[] {
  const result: Move[] = [];
  for (const move of moves) {
    const last = result[result.length - 1];
    if (last !== undefined && last.face === move.face) {
      result.pop();
      const turns = (last.turns + move.turns) % 4;
      if (turns !== 0) result.push({ face: move.face, turns: turns as Turns });
    } else {
      result.push(move);
    }
  }
  return result;
}
