// Runs inside a dedicated worker. The DOM lib's global `postMessage`/`self.onmessage`
// typings are compatible, so no `webworker` lib reference is needed (it would
// clash with the DOM lib in tsconfig).
import { fromFaceletString } from '../cube/state';
import { ensureKociembaReady, solveKociembaSync } from './kociemba';
import type { Solution } from './types';

export type KociembaRequest = { readonly id: number; readonly facelets: string };
export type KociembaResponse =
  | { readonly id: number; readonly ok: true; readonly solution: Solution }
  | { readonly id: number; readonly ok: false; readonly error: string };

ensureKociembaReady();

self.onmessage = (event: MessageEvent<KociembaRequest>): void => {
  const { id, facelets } = event.data;
  try {
    const solution = solveKociembaSync(fromFaceletString(facelets));
    const response: KociembaResponse = { id, ok: true, solution };
    postMessage(response);
  } catch (error) {
    const response: KociembaResponse = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
    postMessage(response);
  }
};
