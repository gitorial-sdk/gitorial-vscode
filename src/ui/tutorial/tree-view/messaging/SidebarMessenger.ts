import * as vscode from 'vscode';
import { UI, Domain } from '@gitorial/shared-types';

export class SidebarMessenger {
  constructor(private readonly webview: vscode.Webview) {}

  async sendDataUpdate(data: {
    stagedFiles   : UI.Messages.SourceCodeFile[];
    unstagedFiles : UI.Messages.SourceCodeFile[];
    mergeFiles    : UI.Messages.SourceCodeFile[];
    stepType      : Domain.Commit.Type;
    stepMessage   : string;
  }): Promise<void> {
    await this.webview.postMessage({
      type     : 'data-update',
      category : 'sidebar',
      payload  : data,
    } satisfies UI.Messages.ExtensionToSidebarMessage);
  }

  async sendFileDataUpdate(data: {
    stagedFiles   : UI.Messages.SourceCodeFile[];
    unstagedFiles : UI.Messages.SourceCodeFile[];
    mergeFiles    : UI.Messages.SourceCodeFile[];
  }): Promise<void> {
    await this.webview.postMessage({
      type     : 'file-data-update',
      category : 'sidebar',
      payload  : data,
    } satisfies UI.Messages.ExtensionToSidebarMessage);
  }

  async sendConflict(data: {
    stepType    : Domain.Commit.Type;
    stepMessage : string;
    mergeFiles  : UI.Messages.SourceCodeFile[];
  }): Promise<void> {
    await this.webview.postMessage({
      type     : 'commit-editing-conflict',
      category : 'sidebar',
      payload  : data,
    } satisfies UI.Messages.ExtensionToSidebarMessage);
  }

  async sendSuccess(): Promise<void> {
    await this.webview.postMessage({
      type     : 'commit-editing-success',
      category : 'sidebar',
    } satisfies UI.Messages.ExtensionToSidebarMessage);
  }
}
