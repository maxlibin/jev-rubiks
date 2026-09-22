import { isMove } from '../cube/notation';
import { layerTurn } from '../scene/grid';
import type { SceneApi } from '../scene/index';
import type { PanelApi } from '../ui/panel';
import type { Effect } from './state';

export type EffectDeps = { readonly scene: SceneApi; readonly panel: PanelApi };

export function runEffects(effects: readonly Effect[], deps: EffectDeps): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'animate':
        deps.scene.enqueue({
          turn: isMove(effect.turnable) ? { kind: 'layer', ...layerTurn(effect.turnable) } : { kind: 'whole' },
          state: effect.state,
          orientation: effect.orientation,
          durationMs: effect.durationMs,
        });
        break;
      case 'snap':
        deps.scene.enqueue({ turn: { kind: 'whole' }, state: effect.state, orientation: effect.orientation, durationMs: 0 });
        break;
      case 'highlight':
        deps.scene.highlightFacelets(effect.facelets);
        break;
      case 'log':
        deps.panel.log(effect.text);
        break;
      case 'resetCamera':
        deps.scene.resetCamera();
        break;
    }
  }
}
