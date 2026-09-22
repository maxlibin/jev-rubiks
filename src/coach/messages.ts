import { formatNotation } from '../cube/notation';
import type { SolveStep } from '../solver/types';
import type { CoachFacts, StageName } from './facts';
import type { MessageKind } from './questions';

export const STAGE_GOALS: Readonly<Record<StageName, string>> = {
  'white cross': 'Put the four white edges around the white centre on the bottom, each one also matching the side centre next to it.',
  'white corners': 'Fill the four bottom corners with the white corners so the whole bottom layer is solved.',
  'middle edges': 'Insert the four middle-layer edges between the matching side centres, completing two layers.',
  'yellow cross': 'Make a yellow cross on the top face; the four top edges show yellow.',
  'yellow face': 'Turn the top corners so the whole top face is yellow.',
  'yellow corners': 'Move the top corners into their correct positions without disturbing the yellow face.',
  'yellow edges': 'Cycle the top edges into place; the cube is solved when this stage ends.',
  solved: 'The cube is solved.',
};

/** Pre-written coach lines; Jev only picks the kind, code fills in the facts. */
export function coachMessage(kind: MessageKind, facts: CoachFacts, nextStep: SolveStep | null): string {
  switch (kind) {
    case 'celebrate_milestone':
      if (facts.solved) return 'Solved! Nicely done.';
      return facts.milestoneReached === null
        ? `Good progress: ${facts.stageProgress}.`
        : `Nice — ${facts.milestoneReached}. Next: ${STAGE_GOALS[facts.stage]}`;
    case 'warn_broke_progress':
      return facts.brokeProgress === null
        ? `Careful: ${facts.lastMove} moved you further from solved.`
        : `Careful: ${facts.lastMove} undid earlier work — ${facts.brokeProgress}. Undo it, or rebuild before moving on.`;
    case 'help_stuck': {
      const where = `${facts.unproductiveStreak} moves without getting closer. You're on the ${facts.stage} (${facts.stageProgress}).`;
      return nextStep === null
        ? `${where} ${STAGE_GOALS[facts.stage]}`
        : `${where} Next: ${nextStep.note} — ${formatNotation(nextStep.moves)}. Press "Show me" to see it on the cube.`;
    }
    case 'explain_stage_goal':
      return `Stage: ${facts.stage} — ${facts.stageProgress}. ${STAGE_GOALS[facts.stage]}`;
    case 'nothing':
      return '';
  }
}
