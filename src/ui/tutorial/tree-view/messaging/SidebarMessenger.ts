import * as vscode from 'vscode';
import { FileStatus } from '../types';
import { UI, Domain } from '@gitorial/shared-types';

export class SidebarMessenger {
  constructor(private readonly webview: vscode.Webview) {}

  async sendDataUpdate(data: {
    stagedFiles   : FileStatus[];
    unstagedFiles : FileStatus[];
    mergeFiles    : FileStatus[];
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
    stagedFiles   : FileStatus[];
    unstagedFiles : FileStatus[];
    mergeFiles    : FileStatus[];
  }): Promise<void> {
    await this.webview.postMessage({
      type     : 'file-data-update',
      category : 'sidebar',
      payload  : data,
    } satisfies UI.Messages.ExtensionToSidebarMessage);
  }

  async sendConflict(mergeFiles: FileStatus[]): Promise<void> {
    await this.webview.postMessage({
      type     : 'commit-editing-conflict',
      category : 'sidebar',
      payload  : { mergeFiles },
    } satisfies UI.Messages.ExtensionToSidebarMessage);
  }

  async sendSuccess(): Promise<void> {
    await this.webview.postMessage({
      type     : 'commit-editing-success',
      category : 'sidebar',
    } satisfies UI.Messages.ExtensionToSidebarMessage);
  }
}
