import { WorkingDirectoryStatus } from '@domain/ports/IGitOperations';
import { UI } from '@gitorial/shared-types';

export class GitStatusMapper {
  static mapToFileStatuses(status: WorkingDirectoryStatus): {
    stagedFiles   : UI.Messages.SourceCodeFile[];
    unstagedFiles : UI.Messages.SourceCodeFile[];
    mergeFiles    : UI.Messages.SourceCodeFile[];
  } {
    const stagedFiles = status.staged.map(
      file =>
        ({
          relativePath : file,
          status       : this.determineFileStatus(file, status),
        }) satisfies UI.Messages.SourceCodeFile
    );

    const unstagedFiles: UI.Messages.SourceCodeFile[] = [...status.modified.filter(f => !status.staged.includes(f))
        .map(f => ({ relativePath: f, status: 'M' }) satisfies UI.Messages.SourceCodeFile),
      ...status.untracked.map(f => ({ relativePath: f, status: 'U' }) satisfies UI.Messages.SourceCodeFile),
      ...status.deleted
        .filter(f => !status.staged.includes(f))
        .map(f => ({ relativePath: f, status: 'D' }) satisfies UI.Messages.SourceCodeFile),
    ];

    const mergeFiles: UI.Messages.SourceCodeFile[] = status.conflicted.map(
      f => ({ relativePath: f, status: 'C' }) satisfies UI.Messages.SourceCodeFile
    );

    return { stagedFiles, unstagedFiles, mergeFiles };
  }

  static determineFileStatus(file: string, status: WorkingDirectoryStatus): UI.Messages.SourceCodeFileStatus {
    if (status.deleted.includes(file)) {
      return 'D';
    } else if (status.modified.includes(file)) {
      return 'M';
    } else if (status.untracked.includes(file)) {
      return 'U';
    } else if (status.conflicted.includes(file)) {
      return 'C';
    } else {
      return 'U';
    }
  }
}
