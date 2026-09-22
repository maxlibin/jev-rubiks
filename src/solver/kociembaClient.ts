import { toFaceletString } from '../cube/state';
import type { CubeState } from '../cube/types';
import type { KociembaRequest, KociembaResponse } from './kociemba.worker';
import type { Solution } from './types';

export type KociembaClient = {
  solve(state: CubeState): Promise<Solution>;
  distance(state: CubeState): Promise<number>;
};

export class KociembaWorkerError extends Error {
  constructor(message: string) {
    super(`Kociemba worker failed: ${message}`);
    this.name = 'KociembaWorkerError';
  }
}

function isResponse(data: unknown): data is KociembaResponse {
  return typeof data === 'object' && data !== null && 'id' in data && 'ok' in data;
}

export function createKociembaClient(): KociembaClient {
  const worker = new Worker(new URL('./kociemba.worker.ts', import.meta.url), { type: 'module' });
  const pending = new Map<number, { resolve(solution: Solution): void; reject(error: Error): void }>();
  let nextId = 1;

  worker.onmessage = (event: MessageEvent<unknown>): void => {
    if (!isResponse(event.data)) {
      throw new KociembaWorkerError(`unexpected message ${JSON.stringify(event.data)}`);
    }
    const entry = pending.get(event.data.id);
    if (entry === undefined) {
      throw new KociembaWorkerError(`no pending request with id ${event.data.id}`);
    }
    pending.delete(event.data.id);
    if (event.data.ok) entry.resolve(event.data.solution);
    else entry.reject(new KociembaWorkerError(event.data.error));
  };

  worker.onerror = (event): void => {
    const error = new KociembaWorkerError(event.message);
    for (const entry of pending.values()) entry.reject(error);
    pending.clear();
  };

  const solve = (state: CubeState): Promise<Solution> =>
    new Promise((resolve, reject) => {
      const id = nextId;
      nextId += 1;
      pending.set(id, { resolve, reject });
      const request: KociembaRequest = { id, facelets: toFaceletString(state) };
      worker.postMessage(request);
    });

  return {
    solve,
    async distance(state) {
      const solution = await solve(state);
      return solution.steps.reduce((sum, step) => sum + step.moves.length, 0);
    },
  };
}
