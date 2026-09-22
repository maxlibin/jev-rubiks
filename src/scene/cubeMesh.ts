import { Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { faceletColor } from '../cube/state';
import type { Color, CubeState } from '../cube/types';
import { DIRECTIONS, faceletIndex, GRID_POSITIONS, type Direction, type GridPosition } from './grid';

export const CUBIE_SIZE = 0.95;

const COLOR_HEX: Readonly<Record<Color, number>> = {
  white: 0xf4f4f4,
  yellow: 0xffd500,
  green: 0x009b48,
  blue: 0x0046ad,
  red: 0xb71234,
  orange: 0xff5800,
};

export type Sticker = {
  readonly direction: Direction;
  readonly facelet: number;
  readonly material: MeshStandardMaterial;
};

export type Cubie = {
  readonly mesh: Mesh;
  readonly position: GridPosition;
  readonly stickers: readonly Sticker[];
};

export type CubeMesh = {
  readonly group: Group;
  readonly cubies: readonly Cubie[];
  /** Facelets the app asked to highlight (coach / teach targets). */
  readonly highlighted: Set<number>;
  /** Facelet under the pointer, if any. */
  hovered: number | null;
};

function plasticMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0x101010, roughness: 0.6, metalness: 0.1 });
}

function stickerMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.0 });
}

function createCubie(position: GridPosition, geometry: RoundedBoxGeometry, plastic: MeshStandardMaterial): Cubie {
  const stickers: Sticker[] = [];
  const materials = DIRECTIONS.map((direction) => {
    const facelet = faceletIndex(position, direction);
    if (facelet === null) return plastic;
    const material = stickerMaterial();
    stickers.push({ direction, facelet, material });
    return material;
  });
  const mesh = new Mesh(geometry, materials);
  mesh.position.set(position.x, position.y, position.z);
  return { mesh, position, stickers };
}

export function createCubeMesh(): CubeMesh {
  const geometry = new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 4, 0.08);
  const plastic = plasticMaterial();
  const group = new Group();
  const cubies = GRID_POSITIONS.map((position) => createCubie(position, geometry, plastic));
  for (const cubie of cubies) group.add(cubie.mesh);
  return { group, cubies, highlighted: new Set(), hovered: null };
}

/** Repaints every sticker from the state; meshes carry no state of their own. */
export function syncFromState(cube: CubeMesh, state: CubeState): void {
  for (const cubie of cube.cubies) {
    for (const sticker of cubie.stickers) {
      sticker.material.color.setHex(COLOR_HEX[faceletColor(state, sticker.facelet)]);
    }
  }
  paintEmissive(cube);
}

/** Puts every cubie back on the grid with identity rotation, directly under the group. */
export function resetCubieTransforms(cube: CubeMesh): void {
  for (const cubie of cube.cubies) {
    if (cubie.mesh.parent !== cube.group) cube.group.add(cubie.mesh);
    cubie.mesh.position.set(cubie.position.x, cubie.position.y, cubie.position.z);
    cubie.mesh.quaternion.identity();
  }
}

function paintEmissive(cube: CubeMesh): void {
  for (const cubie of cube.cubies) {
    for (const sticker of cubie.stickers) {
      if (cube.highlighted.has(sticker.facelet)) {
        sticker.material.emissive.copy(sticker.material.color).multiplyScalar(0.55);
      } else if (cube.hovered === sticker.facelet) {
        sticker.material.emissive.copy(sticker.material.color).multiplyScalar(0.3);
      } else {
        sticker.material.emissive.setHex(0x000000);
      }
    }
  }
}

export function highlightFacelets(cube: CubeMesh, facelets: readonly number[]): void {
  cube.highlighted.clear();
  for (const facelet of facelets) cube.highlighted.add(facelet);
  paintEmissive(cube);
}

export function setHoveredFacelet(cube: CubeMesh, facelet: number | null): void {
  if (cube.hovered === facelet) return;
  cube.hovered = facelet;
  paintEmissive(cube);
}

export function cubieOfMesh(cube: CubeMesh, mesh: Object3D): Cubie {
  const cubie = cube.cubies.find((candidate) => candidate.mesh === mesh);
  if (cubie === undefined) {
    throw new Error('Raycast hit an object that is not a cubie');
  }
  return cubie;
}
