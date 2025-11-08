import { GitState } from './state';
import { GitStateCommit, GitStateData, Hooks } from './types';
import { StateTransitionHandler } from './stf';
import * as vscode from 'vscode';
import { SourceFileWatcher } from './watcher/SourceFileWatcher';
import { StateWatcher } from './watcher/StateWatcher';
import { DebouncedWatcher } from './watcher/DebouncedWatcher';
import { IGitOperations } from '@domain/ports/IGitOperations';

export class GitStateManager implements vscode.Disposable {
  private _state: GitState;
  private _stateTransitionHandler: StateTransitionHandler;

  private sourceFileWatcher: DebouncedWatcher;
  private stateWatcher: DebouncedWatcher;

  constructor(hooks: Hooks, workspacePath: string, gitOps: IGitOperations) {
    this._stateTransitionHandler = new StateTransitionHandler(hooks);
    this._state = new GitState(this._stateTransitionHandler);

    this.sourceFileWatcher = new SourceFileWatcher(workspacePath, gitOps, this._state);
    this.stateWatcher = new StateWatcher(workspacePath, gitOps, this._state);
  }

  /**
   * Gets a copy of the current state
   */
  get state(): GitStateData {
    return this._state.getStateSnapshot;
  }

  public start(commit: GitStateCommit, gitorialHeadHash: string): void {
    this.sourceFileWatcher.start();
    this.stateWatcher.start();
    this._state.mutate({ commit, gitorialHeadHash });
  }

  public stop(): void {
    //we first stop the watchers to avoid and further changes to the state
    this.sourceFileWatcher.stop();
    this.stateWatcher.stop();
    //then we reset the state to the initial state
    this._state.mutate({ gitorialHeadHash: null, commit: null });
  }

  public dispose(): void {
    this.sourceFileWatcher.dispose();
    this.stateWatcher.dispose();
  }
}
