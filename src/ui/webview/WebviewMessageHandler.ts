/*
- Processes messages from webview
- Maps UI actions to domain services
*/

import { UI } from '@gitorial/shared-types';

/**
 * UI-level interface for handling webview commands.
 * This belongs in UI layer, not domain layer.
 */
export interface IWebviewTutorialMessageHandler {
  handleWebviewMessage(message: UI.Messages.WebviewToExtensionTutorialMessage): void;
}

export interface IWebviewSystemMessageHandler {
  handleWebviewMessage(message: UI.Messages.WebviewToExtensionSystemMessageAll): void; //TODO: Find out why this needs a *-ALL
}

export interface IWebviewAuthorMessageHandler {
  handleWebviewMessage(message: UI.Messages.WebviewToExtensionAuthorMessage): Promise<void>;
}

/**
 * Processes messages from the webview and maps UI actions to the TutorialController.
 */
export class WebviewMessageHandler {
  constructor(
    private readonly tutorialMessageHandler: IWebviewTutorialMessageHandler,
    private readonly systemMessageHandler: IWebviewSystemMessageHandler,
    private readonly authorMessageHandler: IWebviewAuthorMessageHandler
  ) {}

  /**
   * Handles messages received from the webview panel.
   * @param message The message object received from the webview.
   */
  public async handleMessage(message: UI.Messages.WebviewToExtensionMessage): Promise<void> {
    switch (message.category) {
      case 'tutorial': {
        this.tutorialMessageHandler.handleWebviewMessage(message);
        break;
      }
      case 'system': {
        this.systemMessageHandler.handleWebviewMessage(message);
        break;
      }
      case 'author': {
        await this.authorMessageHandler.handleWebviewMessage(message);
        break;
      }
      default: {
        console.warn('Received unknown command from webview:', message);
        break;
      }
    }
  }
}
