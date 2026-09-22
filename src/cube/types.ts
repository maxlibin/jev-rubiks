/** Faces in Kociemba facelet order: index / 9 gives the face of a facelet. */
export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type Face = (typeof FACES)[number];

export const COLORS = ['yellow', 'orange', 'green', 'white', 'red', 'blue'] as const;
export type Color = (typeof COLORS)[number];

/** 1 = clockwise quarter turn, 2 = half turn, 3 = counter-clockwise quarter turn. */
export type Turns = 1 | 2 | 3;

export type Move = { readonly face: Face; readonly turns: Turns };

export type Axis = 'x' | 'y' | 'z';

/** Whole-cube rotation: x is like R, y like U, z like F. */
export type Rotation = { readonly axis: Axis; readonly turns: Turns };

/** 54 sticker colours in Kociemba facelet order (U1–U9, R1–R9, F, D, L, B). */
export type CubeState = readonly Color[] & { readonly length: 54 };

/** Which face letter is physically at world +y (up), +z (front) and +x (right). */
export type Orientation = { readonly up: Face; readonly front: Face; readonly right: Face };

/** Standard scheme held white-down: the grip the beginner method assumes. */
export const FACE_COLOR: Readonly<Record<Face, Color>> = {
  U: 'yellow',
  R: 'orange',
  F: 'green',
  D: 'white',
  L: 'red',
  B: 'blue',
};

export const COLOR_FACE: Readonly<Record<Color, Face>> = {
  yellow: 'U',
  orange: 'R',
  green: 'F',
  white: 'D',
  red: 'L',
  blue: 'B',
};

export const OPPOSITE: Readonly<Record<Face, Face>> = {
  U: 'D',
  D: 'U',
  F: 'B',
  B: 'F',
  L: 'R',
  R: 'L',
};
