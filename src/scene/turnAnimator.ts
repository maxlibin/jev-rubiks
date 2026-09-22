import { Object3D, Quaternion } from 'three';
import type { Axis, CubeState, Orientation } from '../cube/types';
import { resetCubieTransforms, syncFromState, type CubeMesh } from './cubeMesh';
import { axisVector, orientationToQuaternion, type GridCoordinate } from './grid';

export type VisualTurn =
  | { readonly kind: 'layer'; readonly axis: Axis; readonly layer: GridCoordinate; readonly angle: number }
  | { readonly kind: 'whole' };

export type AnimationItem = {
  readonly turn: VisualTurn;
  /** Cube state to paint once the turn completes. */
  readonly state: CubeState;
  /** Orientation to apply once the turn completes. */
  readonly orientation: Orientation;
  readonly durationMs: number;
};

export type TurnAnimator = {
  enqueue(item: AnimationItem): void;
  isBusy(): boolean;
  /** Advance the animation; `nowMs` is the caller's clock (performance.now in the browser). */
  tick(nowMs: number): void;
  onIdle(callback: () => void): void;
};

type Running = {
  readonly item: AnimationItem;
  readonly startMs: number;
  readonly pivot: Object3D | null;
  readonly startQuaternion: Quaternion;
  readonly endQuaternion: Quaternion;
};

function easeInOutQuad(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

export function createTurnAnimator(cube: CubeMesh): TurnAnimator {
  const queue: AnimationItem[] = [];
  const idleCallbacks: (() => void)[] = [];
  let running: Running | null = null;

  const begin = (item: AnimationItem, nowMs: number): Running => {
    const endQuaternion = orientationToQuaternion(item.orientation);
    if (item.turn.kind === 'whole') {
      return { item, startMs: nowMs, pivot: null, startQuaternion: cube.group.quaternion.clone(), endQuaternion };
    }
    const pivot = new Object3D();
    cube.group.add(pivot);
    const { axis, layer } = item.turn;
    for (const cubie of cube.cubies) {
      if (cubie.position[axis] === layer) pivot.attach(cubie.mesh);
    }
    return { item, startMs: nowMs, pivot, startQuaternion: cube.group.quaternion.clone(), endQuaternion };
  };

  const finish = (run: Running): void => {
    if (run.pivot !== null) {
      resetCubieTransforms(cube);
      cube.group.remove(run.pivot);
    }
    cube.group.quaternion.copy(run.endQuaternion);
    syncFromState(cube, run.item.state);
  };

  const advance = (run: Running, nowMs: number): boolean => {
    const progress = run.item.durationMs <= 0 ? 1 : Math.min(1, (nowMs - run.startMs) / run.item.durationMs);
    const eased = easeInOutQuad(progress);
    if (run.item.turn.kind === 'layer' && run.pivot !== null) {
      run.pivot.quaternion.setFromAxisAngle(axisVector(run.item.turn.axis), run.item.turn.angle * eased);
    } else {
      cube.group.quaternion.slerpQuaternions(run.startQuaternion, run.endQuaternion, eased);
    }
    return progress >= 1;
  };

  return {
    enqueue(item) {
      queue.push(item);
    },
    isBusy() {
      return running !== null || queue.length > 0;
    },
    tick(nowMs) {
      // Loop so zero-duration items complete within a single tick.
      for (;;) {
        if (running === null) {
          const next = queue.shift();
          if (next === undefined) return;
          running = begin(next, nowMs);
        }
        const done = advance(running, nowMs);
        if (!done) return;
        finish(running);
        running = null;
        if (queue.length === 0) {
          for (const callback of idleCallbacks) callback();
          return;
        }
      }
    },
    onIdle(callback) {
      idleCallbacks.push(callback);
    },
  };
}
