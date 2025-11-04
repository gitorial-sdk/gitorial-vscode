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

  /**
   * Amend the current commit with staged changes and/or new message
   * This is equivalent to: git commit --amend
   */
  async amend(newMessage?: string): Promise<Result<string, Error>> {
    try {
      const status = await this.gitOps.getWorkingDirectoryStatus();

      // Check if there are staged changes or a new message
      if (status.staged.length === 0 && !newMessage) {
        return err('No staged changes or new message provided for amendment');
      }

      const newCommitHash = await this.gitOps.amendCommit(newMessage);
      return ok(newCommitHash);
    } catch (e) {
      return err(`Failed to amend commit: ${e}`);
    }
  }

  async rebaseOntoGitorial(ontoCommit: string): Promise<Result<void, Error>> {
    try {
      await this.gitOps.rebaseOntoGitorial(ontoCommit);
      return ok(undefined);
    } catch (e) {
      return err(`Failed to rebase onto gitorial: ${e}`);
    }
  }
}
