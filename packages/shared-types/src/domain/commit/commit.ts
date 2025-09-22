import { ToDoComment } from './ToDoComment';

export const Types = ['section', 'template', 'solution', 'action', 'readme'] as const;
export type Type = (typeof Types)[number];

export const isType = (value: string): value is Type => (Types as readonly string[]).includes(value);

export type Base<TMeta = {}> = {
  type         : Type;
  title        : string;
  hash         : string;
  changedFiles : Array<string>;
  toDoComments : Array<ToDoComment>;
} & TMeta;
