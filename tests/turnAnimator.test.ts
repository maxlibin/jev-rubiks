import { describe, expect, it } from 'vitest';
import { applyRotation, DEFAULT_ORIENTATION } from '../src/cube/orientation';
import { applyMove, solvedState } from '../src/cube/state';
import { createCubeMesh } from '../src/scene/cubeMesh';
import { layerTurn, orientationToQuaternion } from '../src/scene/grid';
import { createTurnAnimator } from '../src/scene/turnAnimator';

describe('turn animator', () => {
  it('rotates the layer cubies mid-way and snaps them back on completion', () => {
    const cube = createCubeMesh();
    const animator = createTurnAnimator(cube);
    const move = { face: 'R', turns: 1 } as const;
    animator.enqueue({
      turn: { kind: 'layer', ...layerTurn(move) },
      state: applyMove(solvedState(), move),
      orientation: DEFAULT_ORIENTATION,
      durationMs: 100,
    });
    expect(animator.isBusy()).toBe(true);

    animator.tick(0);
    animator.tick(50);
    const rightCubie = cube.cubies.find((c) => c.position.x === 1 && c.position.y === 1 && c.position.z === 1);
    if (rightCubie === undefined) throw new Error('missing cubie');
    const world = rightCubie.mesh.getWorldPosition(rightCubie.mesh.position.clone());
    expect(world.x).toBeCloseTo(1, 6);
    expect(Math.abs(world.y - 1) + Math.abs(world.z - 1)).toBeGreaterThan(0.1);

    animator.tick(100);
    expect(animator.isBusy()).toBe(false);
    expect(rightCubie.mesh.parent).toBe(cube.group);
    expect(rightCubie.mesh.position.toArray()).toEqual([1, 1, 1]);
    expect(rightCubie.mesh.quaternion.w).toBeCloseTo(1, 6);
  });

  it('slerps the group to the target orientation for whole-cube turns and fires idle once', () => {
    const cube = createCubeMesh();
    const animator = createTurnAnimator(cube);
    const orientation = applyRotation(DEFAULT_ORIENTATION, { axis: 'y', turns: 1 });
    let idleCalls = 0;
    animator.onIdle(() => {
      idleCalls += 1;
    });
    animator.enqueue({ turn: { kind: 'whole' }, state: solvedState(), orientation, durationMs: 80 });
    animator.tick(1000);
    animator.tick(1040);
    expect(cube.group.quaternion.angleTo(orientationToQuaternion(orientation))).toBeGreaterThan(0.1);
    animator.tick(1080);
    expect(cube.group.quaternion.angleTo(orientationToQuaternion(orientation))).toBeCloseTo(0, 6);
    expect(idleCalls).toBe(1);
    animator.tick(1100);
    expect(idleCalls).toBe(1);
  });

  it('runs queued items one after another and repaints from the final state', () => {
    const cube = createCubeMesh();
    const animator = createTurnAnimator(cube);
    const state1 = applyMove(solvedState(), { face: 'U', turns: 1 });
    const state2 = applyMove(state1, { face: 'F', turns: 1 });
    animator.enqueue({ turn: { kind: 'layer', ...layerTurn({ face: 'U', turns: 1 }) }, state: state1, orientation: DEFAULT_ORIENTATION, durationMs: 0 });
    animator.enqueue({ turn: { kind: 'layer', ...layerTurn({ face: 'F', turns: 1 }) }, state: state2, orientation: DEFAULT_ORIENTATION, durationMs: 0 });
    expect(animator.isBusy()).toBe(true);
    animator.tick(0);
    expect(animator.isBusy()).toBe(false);
    const f1 = cube.cubies.flatMap((c) => c.stickers).find((s) => s.facelet === 18);
    if (f1 === undefined) throw new Error('missing sticker');
    // After U then F, facelet F1 receives F7's colour (green).
    expect(f1.material.color.getHex()).toBe(0x009b48);
  });
});
