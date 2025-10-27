import { ok, err } from 'neverthrow';
import { Errors } from './errors';
import { Rule } from '../types';

export const SolutionRule: Rule<typeof Errors.SolutionMustFollowTemplateOrAction> = {
  errorCodes : [Errors.SolutionMustFollowTemplateOrAction] as const,
  validate(commits) {
    for (let i = 0; i < commits.length; i++) {
      const { type } = commits[i];
      if (type === 'solution' && commits[i - 1]?.type !== 'template' && commits[i - 1]?.type !== 'action') {
        return err({
          index   : i,
          code    : Errors.SolutionMustFollowTemplateOrAction,
          message : 'solution must immediately follow template or action',
        });
      }
    }
    return ok(void 0);
  },
};
