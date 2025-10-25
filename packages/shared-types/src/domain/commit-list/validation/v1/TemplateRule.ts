import { ok, err } from 'neverthrow';
import { Errors } from './errors';
import { Rule } from '../types';

export const TemplateRule: Rule<
  typeof Errors.TemplateMustBeFollowedBySolution | typeof Errors.SolutionMustFollowTemplateOrAction
> = {
  errorCodes : [Errors.TemplateMustBeFollowedBySolution, Errors.SolutionMustFollowTemplateOrAction] as const,
  validate(commits) {
    for (let i = 0; i < commits.length; i++) {
      const { type } = commits[i];
      if (type === 'template' && commits[i + 1]?.type !== 'solution') {
        return err({
          index   : i,
          code    : Errors.TemplateMustBeFollowedBySolution,
          message : 'template must be immediately followed by solution',
        });
      }
    }
    return ok(void 0);
  },
};
