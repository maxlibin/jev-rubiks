import { describe, expect, it } from 'vitest';
import { formatNotation, invert, isNotation, NotationParseError, parseNotation, simplifyMoves } from '../src/cube/notation';

describe('notation', () => {
  it('parses face moves with prime and double suffixes', () => {
    expect(parseNotation("R U R' U2")).toEqual([
      { face: 'R', turns: 1 },
      { face: 'U', turns: 1 },
      { face: 'R', turns: 3 },
      { face: 'U', turns: 2 },
    ]);
  });

  it('parses whole-cube rotations', () => {
    expect(parseNotation("x y' z2")).toEqual([
      { axis: 'x', turns: 1 },
      { axis: 'y', turns: 3 },
      { axis: 'z', turns: 2 },
    ]);
  });

  it('parses the empty string as no moves', () => {
    expect(parseNotation('')).toEqual([]);
    expect(parseNotation('   ')).toEqual([]);
  });

  it('throws on unknown tokens naming the token', () => {
    expect(() => parseNotation('R M')).toThrow(NotationParseError);
    expect(() => parseNotation('R M')).toThrow('"M"');
  });

  it('formats and round-trips', () => {
    const text = "R U R' U2 x y'";
    expect(formatNotation(parseNotation(text))).toBe(text);
  });

  it('inverts by reversing order and swapping 1 and 3', () => {
    expect(invert(parseNotation("R U2 F'"))).toEqual(parseNotation("F U2 R'"));
  });

  it('recognises pure notation and rejects prose', () => {
    expect(isNotation("R U R' U'")).toBe(true);
    expect(isNotation('turn the top')).toBe(false);
    expect(isNotation('')).toBe(false);
  });
});

describe('simplifyMoves', () => {
  it('cancels and merges consecutive turns of the same face', () => {
    const moves = (text: string) => parseNotation(text).filter((item) => 'face' in item);
    expect(formatNotation(simplifyMoves(moves("U U' R' F R")))).toBe("R' F R");
    expect(formatNotation(simplifyMoves(moves('U U R2 R')))).toBe("U2 R'");
    expect(formatNotation(simplifyMoves(moves('F F F F U')))).toBe('U');
  });
});
