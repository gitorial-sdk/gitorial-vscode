
export const STEP_TYPES = ['section',
  'template',
  'solution',
  'action',
  'readme'] as const;
export type StepType = typeof STEP_TYPES[number];
