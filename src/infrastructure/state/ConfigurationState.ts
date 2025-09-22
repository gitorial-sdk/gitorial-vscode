import { IConfigurationState } from '@domain/ports/IConfigurationState';
import * as vscode from 'vscode';

export class ConfigurationState implements IConfigurationState {
  private readonly configurationSection: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    configurationSection: string = 'gitorial'
  ) {
    this.configurationSection = configurationSection;
  }

  /**
   * Gets a configuration value from VS Code workspace settings
   */
  get<T>(key: string, defaultValue: T): T {
    const config = vscode.workspace.getConfiguration(this.configurationSection);
    return config.get<T>(key, defaultValue);
  }

  /**
   * Updates a configuration value in VS Code workspace settings
   */
  async update<T>(key: string, value: T): Promise<void> {
    const config = vscode.workspace.getConfiguration(this.configurationSection);
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Listens for configuration changes in VS Code settings
   */
  onDidChange(callback: (event: { affectsConfiguration: (section: string) => boolean }) => void): void {
    const disposable = vscode.workspace.onDidChangeConfiguration(event => {
      callback({
        affectsConfiguration : (section: string) => event.affectsConfiguration(section),
      });
    });

    // Add to context subscriptions for proper cleanup
    this.context.subscriptions.push(disposable);
  }
}

/**
 * Factory function to create a ConfigurationState instance
 */
export function createConfigurationState(context: vscode.ExtensionContext, configurationSection?: string): IConfigurationState {
  return new ConfigurationState(context, configurationSection);
}
