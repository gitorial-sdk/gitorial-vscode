/**
 * Tutorial-related messages between Extension and Webview
 */

import { Commit } from '../../domain';

interface SidebarData {
  stagedFiles   : Array<{ path: string; status: string }>;
  unstagedFiles : Array<{ path: string; status: string }>;
  stepType      : Commit.Type;
  stepMessage   : string;
}

// Extension → Webview Tutorial Messages
export type ExtensionToSidebarMessage = { category: 'sidebar'; type: 'data-update'; payload: SidebarData };

// Webview → Extension Tutorial Messages
export type SidebarToExtensionMessage =
  | { category: 'sidebar'; type: 'ready' }
  | { category: 'sidebar'; type: 'validate'; payload: { stepType: Commit.Type; message: string } }
  | { category: 'sidebar'; type: 'commit'; payload: { stepType: Commit.Type; message: string } }
  | { category: 'sidebar'; type: 'stageFile'; payload: { filePath: string } }
  | { category: 'sidebar'; type: 'unstageFile'; payload: { filePath: string } }
  | { category: 'sidebar'; type: 'stageAll' }
  | { category: 'sidebar'; type: 'unstageAll' }
  | { category: 'sidebar'; type: 'openDiff'; payload: { filePath: string } }
  | { category: 'sidebar'; type: 'discardChanges'; payload: { filePath: string } }
  | { category: 'sidebar'; type: 'showError'; payload: { message: string } }
  | { category: 'sidebar'; type: 'refresh' }
  | { category: 'sidebar'; type: 'openFile'; payload: { filePath: string } };
