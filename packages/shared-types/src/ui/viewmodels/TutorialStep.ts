import * as Commit from '../../domain/commit';

export interface TutorialStep {
  id           : string;
  title        : string;
  commitHash   : string;
  type         : Commit.Type;
  isActive     : boolean;
  htmlContent? : string; //Only the active step has HTMLContent
}
