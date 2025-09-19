import { IContextState } from '@domain/ports/IContextState';
import * as vscode from 'vscode';

/**
 * Implements the IContextState port using VS Code's ExtensionContext.
 * This class provides a way to store context values at the workspace state level.
 */
export class ContextState implements IContextState {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Sets a context value at the workspace state level.
   * This method stores the given key-value pair in VS Code's workspaceState,
   * making it available only within the current workspace.
   *
   * @param key - The key to identify the context value.
   * @param value - The value to store for the given key.
   */
  public async setContext(key: string, value: any): Promise<void> {
    vscode.commands.executeCommand('setContext', key, value);
  }
}
