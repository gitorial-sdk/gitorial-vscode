import * as vscode from 'vscode';
import { GitStateData } from '../types';
import { GitState } from '../state';

export abstract class DebouncedWatcher implements vscode.Disposable {
  private timeoutId?: NodeJS.Timeout;
  private readonly debounceMs: number;
  private state: GitState;
  protected isActive = false;

  constructor(state: GitState, debounceMs: number = 500) {
    this.debounceMs = debounceMs;
    this.state = state;
  }

  /**
   * Starts watching by creating watchers and enabling state change processing.
   * Can be called multiple times (idempotent).
   */
  public start(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.setupWatchers();
  }

  /**
   * Stops watching by disposing watchers and clearing pending timeouts.
   * Watchers can be restarted with start(). Idempotent.
   */
  public stop(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.cleanupWatchers();
    this.clearPendingTimeouts();
  }

  /**
   * Triggers a debounced state check. Multiple calls within the debounce window
   * are collapsed into a single check after the timeout expires.
   */
  protected debouncedCheck(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => this.checkAndNotify(), this.debounceMs);
  }

  /**
   * Permanently disposes all resources. Stops watchers if active and clears timeouts.
   * This is final cleanup - watcher cannot be restarted after disposal.
   */
  public dispose(): void {
    if (this.isActive) {
      this.stop();
    }
  }

  private clearPendingTimeouts(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }

  private async checkAndNotify(): Promise<void> {
    const oldState = this.state.state;
    const newPartialState = await this.computeStateDelta();

    if (!this.statesEqual(oldState, newPartialState)) {
      this.state.mutate(newPartialState);
    }
  }

  private statesEqual(a: GitStateData, partialB: Partial<GitStateData>): boolean {
    const b = { ...a, ...partialB };
    return JSON.stringify(a) === JSON.stringify(b);
  }

  /**
   * Computes partial state updates based on current repository state.
   * Called after debounce timeout to determine what changed.
   *
   * @returns Partial state object containing only changed properties
   */
  protected abstract computeStateDelta(): Promise<Partial<GitStateData>>;

  /**
   * Creates and initializes all watchers (VS Code disposables).
   * Called when start() is invoked.
   */
  protected abstract setupWatchers(): void;

  /**
   * Disposes all watchers created in setupWatchers().
   * Called when stop() is invoked. Watchers will be recreated on next start().
   */
  protected abstract cleanupWatchers(): void;
}
