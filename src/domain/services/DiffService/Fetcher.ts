import { GitChangesFactory } from '@infra/factories/GitChangesFactory';
import { DiffFilePayload, IGitChanges } from '@ui/ports/IGitChanges';
import { err, ok, Result } from 'neverthrow';

/**
 * Fetches file diff data from git operations.
 * Handles raw data retrieval and error wrapping.
 */
export class Fetcher {
  gitChanges: IGitChanges | null = null;
  constructor(
    private readonly gitChangesFactory: GitChangesFactory,
    private readonly workspacePath: string
  ) {}

  /** Fetch raw diff data for a commit */
  public async getDiffFilePayloads(commitHash: string): Promise<Result<DiffFilePayload[], unknown>> {
    if (!this.gitChanges) {
      this.gitChanges = this.gitChangesFactory.createFromPath(this.workspacePath);
    }
    try {
      return ok(await this.gitChanges.getCommitDiff(commitHash));
    } catch (error) {
      return err(error);
    }
  }
}
