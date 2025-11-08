import { UI } from '@gitorial/shared-types';
import { GitStateData, Hooks } from './types';

export class StateTransitionHandler {
  private hooks: Hooks;

  constructor(hooks: Hooks) {
    this.hooks = hooks;
  }

  public transition(oldState: GitStateData, newPartialState: Partial<GitStateData>): GitStateData {
    const newState = { ...oldState, ...newPartialState };

    if (!oldState.isRebasing && newState.isRebasing) {
      this.hooks.onRebaseStart?.();
    }
    if (oldState.isRebasing && !newState.isRebasing) {
      if (newState.hasConflict) {
        this.hooks.onRebaseConflict?.({
          stepType    : newState.commit.type,
          stepMessage : newState.commit.message,
          mergeFiles  : newState.files.merge,
        });
      } else {
        if (newState.gitorialHeadHash === oldState.gitorialHeadHash) {
          this.hooks.onRebaseAbort?.();
        } else {
          this.hooks.onRebaseSuccess?.();
        }
      }
    }

    if (this.hasFileChanges(oldState, newState)) {
      this.hooks.onSourceFileChange?.({
        stagedFiles   : newState.files.staged,
        unstagedFiles : newState.files.unstaged,
        mergeFiles    : newState.files.merge,
      });
    }

    return newState;
  }

  /**
   * Checks if file lists have changed between states.
   * Compares both the file path and Git status to determine equality.
   */
  private hasFileChanges(oldState: GitStateData, newState: GitStateData): boolean {
    const { staged: newStaged, unstaged: newUnstaged, merge: newMerge } = newState.files;
    const { staged: oldStaged, unstaged: oldUnstaged, merge: oldMerge } = oldState.files;

    if (newStaged.length !== oldStaged.length) return true;
    if (newUnstaged.length !== oldUnstaged.length) return true;
    if (newMerge.length !== oldMerge.length) return true;

    return this.fileArraysDiffer(newStaged, oldStaged) ||
      this.fileArraysDiffer(newUnstaged, oldUnstaged) ||
      this.fileArraysDiffer(newMerge, oldMerge);
  }

  /**
   * Checks if two SourceCodeFile arrays differ in content.
   * Uses a Set with composite keys for O(n) time complexity.
   *
   * @param arr1 First array to compare
   * @param arr2 Second array to compare
   * @returns true if arrays contain different files (by path and status)
   */
  private fileArraysDiffer(arr1: UI.Messages.SourceCodeFile[], arr2: UI.Messages.SourceCodeFile[]): boolean {
    const fileKeys = new Set(arr2.map(f => `${f.relativePath}|${f.status}`));
    return arr1.some(f => !fileKeys.has(`${f.relativePath}|${f.status}`));
  }
}
