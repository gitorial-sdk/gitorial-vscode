import { Base } from '../../commit';
import { parseMessageV1 } from './message/parse';
import { V1 } from './index';
import { Result, err, ok } from 'neverthrow';
import { Error } from '../types';
import { Errors } from './errors';
import { ToDoComment } from '../../ToDoComment';

export const Validator = {
  parseMessage : parseMessageV1,
  validateContent(commit: Base) {
    return V1.RulesByType[commit.type].validate(commit);
  },
  buildCommitFromMessage(
    //TODO: rename to 'validate'
    message: string,
    hash: string,
    changedFiles: ReadonlyArray<string>,
    toDoComments: ReadonlyArray<ToDoComment>
  ) : Result<Base, Error<keyof typeof Errors>> {
    const parsed = parseMessageV1(message);
    if (parsed.isErr()) {
      return err(parsed.error);
    }
    const { type, title } = parsed._unsafeUnwrap();
    const commit: Base = {
      type,
      title,
      hash,
      changedFiles : [...changedFiles],
      toDoComments : toDoComments.map(t => ({ realtiveFilePath: t.realtiveFilePath })),
    };
    const content = V1.RulesByType[type].validate(commit);
    if (content.isErr()) {
      return err(content.error);
    }
    return ok(commit);
  },
};
