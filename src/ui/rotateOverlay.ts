import type { Rotation } from '../cube/types';

type RotateButton = {
  readonly testId: string;
  readonly title: string;
  readonly rotation: Rotation;
  readonly className: string;
  /** Degrees to rotate the curved-arrow icon; the base icon curves to the right. */
  readonly iconRotation: number;
  readonly mirrored: boolean;
};

/** Whole-cube rotations as the viewer sees them: x tilts the front up, y spins the front to the left, z rolls clockwise. */
const BUTTONS: readonly RotateButton[] = [
  { testId: 'rotate-up', title: 'Tilt up (x)', rotation: { axis: 'x', turns: 1 }, className: 'top', iconRotation: -90, mirrored: false },
  { testId: 'rotate-down', title: "Tilt down (x')", rotation: { axis: 'x', turns: 3 }, className: 'bottom', iconRotation: 90, mirrored: false },
  { testId: 'rotate-left', title: 'Spin left (y)', rotation: { axis: 'y', turns: 1 }, className: 'left', iconRotation: 0, mirrored: true },
  { testId: 'rotate-right', title: "Spin right (y')", rotation: { axis: 'y', turns: 3 }, className: 'right', iconRotation: 0, mirrored: false },
  { testId: 'rotate-roll-left', title: "Roll left (z')", rotation: { axis: 'z', turns: 3 }, className: 'top-left', iconRotation: -45, mirrored: true },
  { testId: 'rotate-roll-right', title: 'Roll right (z)', rotation: { axis: 'z', turns: 1 }, className: 'top-right', iconRotation: 45, mirrored: false },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A curved arrow: an arc sweeping clockwise with an arrowhead at its end. */
function curvedArrowIcon(rotationDeg: number, mirrored: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '22');
  svg.setAttribute('height', '22');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M5 15 A8 8 0 0 1 18 8 M18 8 L13 8 M18 8 L18 13');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  svg.style.transform = `${mirrored ? 'scaleX(-1) ' : ''}rotate(${rotationDeg}deg)`;
  return svg;
}

/** Curved rotate buttons overlaid on the 3D view; visible while the pointer is over it. */
export function createRotateOverlay(container: HTMLElement, onRotate: (rotation: Rotation) => void): void {
  const overlay = document.createElement('div');
  overlay.className = 'rotate-overlay';
  for (const spec of BUTTONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `rotate ${spec.className}`;
    button.title = spec.title;
    button.setAttribute('aria-label', spec.title);
    button.setAttribute('data-testid', spec.testId);
    button.append(curvedArrowIcon(spec.iconRotation, spec.mirrored));
    button.addEventListener('click', () => onRotate(spec.rotation));
    overlay.append(button);
  }
  container.append(overlay);
}
