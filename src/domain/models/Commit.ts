import { Result, err, ok } from 'neverthrow';
import { Domain } from '@gitorial/shared-types';

type TCommitError<T extends string> = Domain.Commit.Validation.Error<T>;
type TCommit = Domain.Commit.Base;
type TCommitType = Domain.Commit.Type;
type TToDoComment = Domain.Commit.ToDoComment;

export class Commit {
  private _data: TCommit;
  private constructor(
    type: TCommitType,
    title: string,
    hash: string,
    changedFiles: Array<string>,
    toDoComments: Array<TToDoComment>
  ) {
    this._data = {
      type,
      title,
      hash,
      changedFiles,
      toDoComments,
    };
  }

  public static new(
    message: string,
    hash: string,
    changedFiles: Array<string>,
    toDoComments: Array<TToDoComment>
  ): Result<Commit, TCommitError<string>> {
    return Commit.validate(message, hash, changedFiles, toDoComments);
  }

  public static newWithType(
    type: TCommitType,
    title: string,
    hash: string,
    changedFiles: Array<string>,
    toDoComments: Array<TToDoComment>
  ): Result<Commit, TCommitError<string>> {
    const commit = new Commit(type, title, hash, changedFiles, toDoComments);
    const result = Domain.Commit.V1.Validator.validateContent(commit.data);
    if (result.isErr()) {
      const errMsg = result._unsafeUnwrapErr();
      return err({ code: errMsg.code, message: errMsg.message });
    }
    return ok(commit);
  }

  public static newFromObject(data: TCommit): Result<Commit, TCommitError<string>> {
    const commit = new Commit(data.type, data.title, data.hash, data.changedFiles, data.toDoComments);
    const result = Domain.Commit.V1.Validator.validateContent(commit.data);
    if (result.isErr()) {
      const errMsg = result._unsafeUnwrapErr();
      return err({ code: errMsg.code, message: errMsg.message });
    }
    return ok(commit);
  }

  private static validate(
    message: string,
    hash: string,
    changedFiles: Array<string>,
    toDoComments: Array<TToDoComment>
  ): Result<Commit, TCommitError<string>> {
    const built = Domain.Commit.V1.Validator.buildCommitFromMessage(message, hash, changedFiles, toDoComments);
    if (built.isErr()) {
      return err(built.error);
    }
    const data = built._unsafeUnwrap();
    return ok(new Commit(data.type, data.title, data.hash, data.changedFiles, data.toDoComments));
  }

  public toString(): string {
    return `${this.data.type}: ${this.data.title}`;
  }

  public get data(): Readonly<TCommit> {
    return this._data;
  }
}
