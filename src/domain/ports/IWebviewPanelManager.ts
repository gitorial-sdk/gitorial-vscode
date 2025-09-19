import { UI } from '@gitorial/shared-types';

export interface IWebviewPanelManager {
  sendMessage(message: UI.Messages.ExtensionToWebviewMessage): Promise<void>;
  updateMessageHandler(messageHandler: (message: any) => void): void;
  isVisible(): boolean;
  show(): void;
  dispose(): void;
}
