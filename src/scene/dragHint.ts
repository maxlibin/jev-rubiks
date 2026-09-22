import type { HoverHint } from './dragControls';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A double-headed arrow, horizontal; rotated per drag axis. */
function doubleArrow(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '-40 -12 80 24');
  svg.setAttribute('width', '80');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M-30 0 L30 0 M-30 0 L-22 -6 M-30 0 L-22 6 M30 0 L22 -6 M30 0 L22 6');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '3');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

export type DragHint = { update(hint: HoverHint | null): void };

/** Shows two arrows over the hovered sticker, aligned with the layers a drag would turn. */
export function createDragHint(container: HTMLElement): DragHint {
  const root = document.createElement('div');
  root.className = 'drag-hint';
  root.hidden = true;
  const arrows = [doubleArrow(), doubleArrow()];
  for (const arrow of arrows) root.append(arrow);
  container.append(root);
  return {
    update(hint) {
      if (hint === null) {
        root.hidden = true;
        return;
      }
      root.hidden = false;
      root.style.left = `${hint.x}px`;
      root.style.top = `${hint.y}px`;
      arrows.forEach((arrow, index) => {
        const angle = hint.angles[index];
        if (angle !== undefined) arrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      });
    },
  };
}
