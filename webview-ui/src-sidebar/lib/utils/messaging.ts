import type { UI } from '@gitorial/shared-types';
import { vscode } from '@shared/utils/vscode';

// Helper type to remove 'category' from each union member
type WithoutCategory<T> = T extends { category: 'sidebar' } ? Omit<T, 'category'> : never;

// Function to send messages to extension
export function sendMessage(message: WithoutCategory<UI.Messages.SidebarToExtensionMessage>) {
  vscode.postMessage({ ...message, category: 'sidebar' } as UI.Messages.SidebarToExtensionMessage);
}
