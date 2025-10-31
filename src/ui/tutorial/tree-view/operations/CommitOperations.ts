import { IGitOperations } from '@domain/ports/IGitOperations';
import { Domain } from '@gitorial/shared-types';
import { err, ok, Result } from 'neverthrow';

type Error = string;

// CommitOperations.ts
export class CommitOperations {
  constructor(private readonly gitOps: IGitOperations) {}

  async commit(stepType: Domain.Commit.Type, message: string): Promise<Result<string, Error>> {
    try {
      const commitHash = await this.gitOps.createCommit(`${stepType}: ${message}`);
      return ok(commitHash);
    } catch (e) {
      return err(`Failed to create commit.\nError: ${e}`);
    }
  }
}
