import { Type } from './commit';

export interface StepData {
  id: string;
  title: string;
  commitHash: string;
  type: Type;
  index: number;
}
