import { WorkingDirectoryStatus } from '@domain/ports/IGitOperations';
import { FileStatus, FileStatusCode } from '../types';

export class GitStatusMapper {
  static mapToFileStatuses(status: WorkingDirectoryStatus): {
    stagedFiles   : FileStatus[];
    unstagedFiles : FileStatus[];
    mergeFiles    : FileStatus[];
  } {
    const stagedFiles = status.staged.map(file => ({
      path   : file,
      status : this.determineFileStatus(file, status),
    }));

    const unstagedFiles: FileStatus[] = [...status.modified.filter(f => !status.staged.includes(f))
        .map(f => ({ path: f, status: 'M' }) satisfies FileStatus),
      ...status.untracked.map(f => ({ path: f, status: 'U' }) satisfies FileStatus),
      ...status.deleted
        .filter(f => !status.staged.includes(f))
        .map(f => ({ path: f, status: 'D' }) satisfies FileStatus),
    ];

    const mergeFiles: FileStatus[] = status.conflicted.map(f => ({ path: f, status: 'C' }) satisfies FileStatus);

    return { stagedFiles, unstagedFiles, mergeFiles };
  }

  static determineFileStatus(file: string, status: WorkingDirectoryStatus): FileStatusCode {
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
