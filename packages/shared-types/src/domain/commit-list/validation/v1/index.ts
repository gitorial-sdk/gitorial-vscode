import { TemplateRule } from './TemplateRule';
import { ReadmeLastRule } from './ReadmeRule';
import { ActionRule } from './ActionRule';
import { SectionRule } from './SectionRule';
import { SolutionRule } from './SolutionRule';
import { Errors } from './errors';
import { Rule } from '../types';

const Rules: Rule<keyof typeof Errors>[] = [TemplateRule, SectionRule, ActionRule, ReadmeLastRule, SolutionRule];

export const V1 = {
  Rules,
  Errors,
};
