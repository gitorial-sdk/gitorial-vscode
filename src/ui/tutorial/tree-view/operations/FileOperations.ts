import { IGitOperations } from '@domain/ports/IGitOperations';
import { err, ok, Result } from 'neverthrow';

type Error = string;

/**
 * Wrapper for Git Operations on Files
 * @note uses Result despite most methods not returning any errors.
 * This is a preparation for future use of neverthrow more extensively
 */
export class FileOperations {
  constructor(private readonly gitOps: IGitOperations) {}

  async stageFile(filePath: string): Promise<Result<void, Error>> {
    await this.gitOps.stageFiles([filePath]);
    return ok();
  }
  async unstageFile(filePath: string): Promise<Result<void, Error>> {
    await this.gitOps.reset(['HEAD', '--', filePath]);
    return ok();
  }
  async stageAll(): Promise<Result<void, Error>> {
    await this.gitOps.stageAllChanges();
    return ok();
  }
  async unstageAll(): Promise<Result<void, Error>> {
    await this.gitOps.reset(['HEAD']);
    return ok();
  }
  async discardChanges(filePath: string): Promise<Result<void, Error>> {
    await this.gitOps.discardChanges([filePath]);
    return ok();
  }

  /**
   * Get information about unstaged changes (pure query, no side effects)
   * Used to check if there are changes to discard before showing confirmation dialog
   */
  async getUnstagedChangesInfo(): Promise<{
    unstagedCount: number;
    unstagedFiles: string[];
    untrackedFiles: string[];
  }> {
    const status = await this.gitOps.getWorkingDirectoryStatus();
    const stagedSet = new Set(status.staged);

    // Get only unstaged modified/deleted files
    const unstagedModified = status.modified.filter(f => !stagedSet.has(f));
    const unstagedDeleted = status.deleted.filter(f => !stagedSet.has(f));
    const unstagedFiles = [...unstagedModified, ...unstagedDeleted];

    const unstagedCount = unstagedFiles.length + status.untracked.length;

    return {
      unstagedCount,
      unstagedFiles,
      untrackedFiles: status.untracked,
    };
  }

  /**
   * Discard all unstaged changes
   * @param unstagedFiles - List of unstaged tracked files (modified/deleted) to discard
   * @param untrackedFiles - List of untracked files to clean
   */
  async discardAllUnstaged(
    unstagedFiles: string[],
    untrackedFiles: string[]
  ): Promise<Result<void, Error>> {
    // Discard changes in unstaged tracked files
    if (unstagedFiles.length > 0) {
      await this.gitOps.discardChanges(unstagedFiles);
    }

    // Clean untracked files (git clean -fd)
    if (untrackedFiles.length > 0) {
      await this.gitOps.cleanWorkingDirectory();
    }

    return ok();
  }
  /**
   * Resets the current state to the commits original state
   */
  async resetAll(): Promise<Result<void, Error>> {
    await this.gitOps.reset(['HEAD']);
    // Then, discard all unstaged changes
    await this.gitOps.resetWorkingDirectory();
    return ok();
  }
}

export { Error as FileOperationsError };
