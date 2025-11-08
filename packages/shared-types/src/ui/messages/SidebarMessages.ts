/**
 * Tutorial-related messages between Extension and Webview
 */

import { Commit } from '../../domain';

/**
 * A file in the source code
 */
export type SourceCodeFile = {
  relativePath : string;
  status       : SourceCodeFileStatus;
};

/**
 * The status symbol (M = Modified, D = Deleted, U = New, C = Conflicted)
 */
export type SourceCodeFileStatus = 'M' | 'D' | 'U' | 'C';

interface SidebarData {
  stagedFiles   : Array<SourceCodeFile>;
  unstagedFiles : Array<SourceCodeFile>;
  mergeFiles    : Array<SourceCodeFile>;
  stepType      : Commit.Type;
  stepMessage   : string;
}

// Extension → Webview Tutorial Messages
export type ExtensionToSidebarMessage =
  | { category: 'sidebar'; type: 'data-update'; payload: SidebarData }
  | {
      category : 'sidebar';
      type     : 'file-data-update';
      payload  : {
        stagedFiles   : Array<SourceCodeFile>;
        unstagedFiles : Array<SourceCodeFile>;
        mergeFiles    : Array<SourceCodeFile>;
      };
    }
  | {
      category : 'sidebar';
      type     : 'commit-editing-conflict';
      payload  : {
        stepType    : Commit.Type;
        stepMessage : string;
        mergeFiles  : Array<SourceCodeFile>;
      };
    }
  | {
      category : 'sidebar';
      type     : 'commit-editing-success';
    };

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
  | { category: 'sidebar'; type: 'discardAllUnstaged' }
  | { category: 'sidebar'; type: 'showError'; payload: { message: string } }
  | { category: 'sidebar'; type: 'refresh' }
  | { category: 'sidebar'; type: 'openFile'; payload: { filePath: string } }
  | { category: 'sidebar'; type: 'safe'; payload: { stepType: Commit.Type; message: string } };
