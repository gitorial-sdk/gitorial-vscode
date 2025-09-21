import { Domain } from '@gitorial/shared-types';

export interface TutorialStep {
  id: string;
  title: string;
  commitHash: string;
  type: Domain.Commit.Type;
  isActive: boolean;
  htmlContent?: string; //Only the active step has HTMLContent
}
