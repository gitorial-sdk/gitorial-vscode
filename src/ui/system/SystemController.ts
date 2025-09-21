import { UI, Domain } from '@gitorial/shared-types';
import { IWebviewSystemMessageHandler } from '../webview/WebviewMessageHandler';
import { IWebviewPanelManager } from '@domain/ports/IWebviewPanelManager';
import { CONFIG_CONSTANTS as CC } from './SystemControllerConstants';
import { IContextState } from '@domain/ports/IContextState';
import { IConfigurationState } from '@domain/ports/IConfigurationState';
import { IUserInteraction } from '@domain/ports/IUserInteraction';
import { IStateStorage } from '@domain/ports/IStateStorage';

/**
 * Controller responsible for managing system-level operations and communication
 * between the extension and webview components.
 */
export class SystemController implements IWebviewSystemMessageHandler {
  private tutorialController: any; // Will be set after TutorialController is created

  private constructor(
    private readonly contextState: IContextState,
    private readonly configurationState: IConfigurationState,
    private readonly webviewPanelManager: IWebviewPanelManager,
    readonly userInteraction: IUserInteraction
  ) {}

  public static async new(
    contextStore: IContextState,
    configurationStore: IConfigurationState,
    webviewPanelManager: IWebviewPanelManager,
    userInteraction: IUserInteraction
  ): Promise<SystemController> {
    const systemController = new SystemController(
      contextStore,
      configurationStore,
      webviewPanelManager,
      userInteraction
    );
    await systemController.initializeAuthorModeState();
    systemController.registerConfigurationListener();
    return systemController;
  }

  /**
   * Initializes author mode state on extension startup.
   * This should be called during extension activation to restore the previous state.
   */
  public async initializeAuthorModeState(): Promise<void> {
    try {
      const storedState = this.configurationState.get<boolean>(CC.AUTHOR_MODE_KEY, false);
      await this.contextState.setContext(CC.AUTHOR_MODE_CONTEXT, storedState);
      console.log(`SystemController: Initialized author mode state to ${storedState}`);
    } catch (error) {
      console.error('SystemController: Failed to initialize author mode state:', error);
    }
  }

  private registerConfigurationListener(): void {
    this.configurationState.onDidChange(async event => {
      if (event.affectsConfiguration(CC.AUTHOR_MODE_CONTEXT)) {
        const newValue = this.configurationState.get<boolean>(CC.AUTHOR_MODE_KEY, false);
        await this.contextState.setContext(CC.AUTHOR_MODE_CONTEXT, newValue);

        this.sendSystemMessage({ category: 'system', type: 'author-mode-changed', payload: { isActive: newValue } });
      }
    });
  }

  /**
   * Set the tutorial controller reference after it's created
   */
  public setTutorialController(tutorialController: any): void {
    this.tutorialController = tutorialController;
  }

  // ============================================================================
  // Webview Message Handling
  // ============================================================================

  /**
   * Handles incoming messages from the webview.
   * @param message - The message received from the webview
   */
  public async handleWebviewMessage(message: UI.Messages.WebviewToExtensionSystemMessageAll): Promise<void> {
    try {
      switch (message.type) {
        case 'error':
          await this.handleError(message.payload);
          break;
        case 'requestConfirm':
          // Show a native confirm dialog and return result
          try {
            const result = await this.userInteraction.showWarningMessage(
              message.payload.message,
              { modal: true },
              'Yes',
              'No'
            );

            const confirmed = result === 'Yes';
            await this.sendSystemMessage({
              category: 'system',
              type: 'confirmResult',
              payload: { id: message.payload.id, confirmed },
            } as any);
          } catch (e) {
            console.warn('SystemController: Failed to show confirm dialog', e);
          }
          break;
        default:
          console.warn(`Unknown message type: ${(message as any).type}`);
      }
    } catch (error) {
      console.error('Error handling webview message:', error);
    }
  }

  /**
   * Sends a system message to the webview.
   * @param message - The message to send to the webview
   */
  public async sendSystemMessage(message: UI.Messages.ExtensionToWebviewSystemMessageAll): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage(message);
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending system message to webview',
        true
      );
    }
  }

  // ============================================================================
  // Loading State Management
  // ============================================================================

  /**
   * Shows or hides the loading state in the webview.
   * @param isLoading - Whether to show the loading state
   * @param message - The loading message to display
   */
  public async showLoadingState(isLoading: boolean, message: string): Promise<void> {
    await this.sendSystemMessage({
      category: 'system',
      type: 'loading-state',
      payload: { isLoading, message },
    });
  }

  /**
   * Hides the loading state in the webview.
   */
  public hideLoadingState = (): Promise<void> => this.showLoadingState(false, '');

  // ============================================================================
  // Error Handling and User Feedback
  // ============================================================================

  /**
   * Shows an error message in the webview.
   * @param message - The error message to display
   */
  public async showError(message: string): Promise<void> {
    await this.sendSystemMessage({
      category: 'system',
      type: 'error',
      payload: { message },
    });
  }

  /**
   * Reports an error with optional user notification.
   * @param error - The error that occurred
   * @param context - Context where the error occurred
   * @param showToUser - Whether to show the error to the user
   */
  public async reportError(error: Error, context: string, showToUser: boolean = false): Promise<void> {
    const message = `${context}: ${error.message}`;
    console.error(message);

    if (showToUser) {
      try {
        await this.userInteraction.showErrorMessage(message);
      } catch (showError) {
        console.error('Failed to show error message to user:', showError);
      }
    }
  }

  // ============================================================================
  // Author Mode Management
  // ============================================================================

  /**
   * Sets the author mode state and notifies the webview.
   * @param isActive - Whether author mode should be active
   */
  public async setAuthorMode(isActive: boolean): Promise<void> {
    await this.configurationState.update(CC.AUTHOR_MODE_KEY, isActive); //we change here the configurationState (.json file) to persist it
    await this.contextState.setContext(CC.AUTHOR_MODE_CONTEXT, isActive); //we change the context so that pallet settings change

    await this.sendSystemMessage({
      category: 'system',
      type: 'author-mode-changed',
      payload: { isActive },
    });
  }

  /**
   * Gets the current author mode state from configuration.
   * @returns Whether author mode is currently active
   */
  public getAuthorMode(): boolean {
    return this.configurationState.get<boolean>(CC.AUTHOR_MODE_KEY, false);
  }

  /**
   * Sends author manifest data to the webview.
   * @param manifest - The author manifest data
   * @param isEditing - Whether the manifest is being edited
   */
  public async sendAuthorManifest(manifest: Domain.AuthorManifestData, isEditing: boolean): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'manifestLoaded',
        payload: {
          manifest,
          isEditing,
        },
      });
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending author manifest to webview',
        true
      );
    }
  }

  /**
   * Sends author manifest data to the webview.
   * @param manifest - The author manifest data
   * @param isEditing - Whether the manifest is being edited
   */
  public async showGlobalLoading(message: string): Promise<void> {
    if (this.webviewPanelManager) {
      const systemMessage: UI.Messages.ExtensionToWebviewSystemMessage = {
        category: 'system',
        type: 'loading-state',
        payload: { isLoading: true, message },
      };
      await this.webviewPanelManager.sendMessage(systemMessage);
    }
  }

  /**
   * Sends publish result information to the webview.
   * @param success - Whether the publish operation was successful
   * @param error - Error message if the publish failed
   * @param publishedCommits - Information about published commits
   */
  public async sendPublishResult(
    success: boolean,
    error?: string,
    publishedCommits?: Array<{ originalCommit: string; newCommit: string; stepTitle: string; stepType: string }>
  ): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'publishResult',
        payload: {
          success,
          error,
          publishedCommits,
        },
      });
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending publish result to webview',
        true
      );
    }
  }

  /**
   * Sends validation warnings to the webview.
   * @param warnings - Array of validation warning messages
   */
  public async sendValidationWarnings(warnings: string[]): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'validationWarnings',
        payload: {
          warnings,
        },
      });
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending validation warnings to webview',
        true
      );
    }
  }

  /**
   * Sends step editing started notification to the webview.
   * @param stepIndex - The index of the step being edited
   * @param step - The step data
   */
  public async sendEditingStarted(stepIndex: number, step: Domain.ManifestStep): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'editingStarted',
        payload: {
          stepIndex,
          step,
        },
      });
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending editing started notification to webview',
        true
      );
    }
  }

  /**
   * Notify the webview that a file was saved while editing a step.
   * @param stepIndex - The index of the step being edited
   */
  public async sendEditingFileSaved(stepIndex: number): Promise<void> {
    try {
      // Cast to any because webview message union in some places is narrower; this is a safe runtime message
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'editingFileSaved',
        payload: { stepIndex },
      } as any);
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending editing file-saved notification to webview',
        true
      );
    }
  }

  /**
   * Sends step editing saved notification to the webview.
   * @param stepIndex - The index of the step that was saved
   * @param updatedManifest - The updated manifest with new step data
   */
  public async sendEditingSaved(stepIndex: number, updatedManifest: Domain.AuthorManifestData): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'editingSaved',
        payload: {
          stepIndex,
          updatedManifest,
        },
      });
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending editing saved notification to webview',
        true
      );
    }
  }

  /**
   * Sends step editing cancelled notification to the webview.
   * @param stepIndex - The index of the step that was cancelled
   */
  public async sendEditingCancelled(stepIndex: number): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'editingCancelled',
        payload: {
          stepIndex,
        },
      });
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending editing cancelled notification to webview',
        true
      );
    }
  }

  // ============ EXTENSION LIFECYCLE ============

  /**
   * Called during extension activation
   */
  public async sendEditingError(stepIndex: number, error: string): Promise<void> {
    try {
      await this.webviewPanelManager.sendMessage({
        category: 'author',
        type: 'editingError',
        payload: {
          stepIndex,
          error,
        },
      });
    } catch (error) {
      await this.reportError(
        error instanceof Error ? error : new Error(String(error)),
        'Sending editing error notification to webview',
        true
      );
    }
  }

  /**
   * Force refresh the current tutorial after structural changes (like republishing)
   */
  public async forceRefreshTutorial(): Promise<void> {
    if (this.tutorialController && this.tutorialController.forceRefreshCurrentTutorial) {
      console.log('SystemController: Requesting tutorial refresh');
      await this.tutorialController.forceRefreshCurrentTutorial();
    } else {
      console.warn('SystemController: Tutorial controller not available for refresh');
    }
  }

  private async handleError(payload: { message: string; details?: string }): Promise<void> {
    await this.userInteraction.showErrorMessage(`Webview Error: ${payload.message}`);
    if (payload.details) {
      await this.userInteraction.showErrorMessage(payload.details);
    }
  }
}
