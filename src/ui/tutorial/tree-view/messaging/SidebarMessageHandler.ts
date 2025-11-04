import { Domain, UI } from '@gitorial/shared-types';
import { FileOperations } from '../operations/FileOperations';
import { CommitOperations } from '../operations/CommitOperations';
import { DiffOperations } from '../operations/DiffOperations';
import * as path from 'path';
import * as vscode from 'vscode';
import { NavigationOperations } from '../operations/NavigationOperations';
import { IGitOperations } from '@domain/ports/IGitOperations';

export class SidebarMessageHandler {
  constructor(
    private readonly fileOps: FileOperations,
    private readonly commitOps: CommitOperations,
    private readonly diffOps: DiffOperations,
    private readonly navOps: NavigationOperations,
    private readonly gitOps: IGitOperations,
    private readonly onRefresh: () => Promise<void>
  ) {}

  async handle(message: UI.Messages.SidebarToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'stageFile':
        await this.handleStageFile(message.payload.filePath);
        break;
      case 'commit':
        await this.handleCommit(message.payload.stepType, message.payload.message);
        break;
      case 'unstageFile':
        await this.handleUnstageFile(message.payload.filePath);
        break;
      case 'stageAll':
        await this.handleStageAll();
        break;
      case 'unstageAll':
        await this.handleUnstageAll();
        break;
      case 'openDiff':
        await this.handleOpenDiff(message.payload.filePath);
        break;
      case 'openFile':
        await this.handleOpenFile(message.payload.filePath);
        break;
      case 'discardChanges':
        await this.handleDiscardChanges(message.payload.filePath);
        break;
      case 'discardAllUnstaged':
        await this.handleDiscardAllUnstaged();
        break;
      case 'refresh':
        await this.onRefresh();
        break;
      case 'ready':
        await this.handleReady();
        break;
      case 'validate':
        await this.handleValidate();
        break;
      case 'showError':
        this.emitError(message.payload.message);
        break;
      default:
        this.emitError(`Unknown Sidebar -> Extension Message received\nMessage: ${message}`);
    }
  }

  private async handleStageFile(filePath: string): Promise<void> {
    const result = await this.fileOps.stageFile(filePath);
    if (result.isOk()) {
      await this.onRefresh();
    } else {
      this.emitError(result.error);
    }
  }

  private async handleCommit(stepType: Domain.Commit.Type, message: string): Promise<void> {
    const checkedOutCommit = await this.gitOps.getCurrentCommitHash();
    const isRebaseInProgress = await this.gitOps.isRebaseInProgress();
    const hasConflicts = await this.gitOps.hasRebaseConflicts();

    if (isRebaseInProgress) {
      // We're in a rebase - user wants to continue (either after resolving conflicts or normally)
      const rebaseContinueResult = await this.commitOps.rebaseContinue();
      if (rebaseContinueResult.isErr()) {
        this.emitError(rebaseContinueResult.error);
        return;
      }

      const message = hasConflicts
        ? 'Rebase conflicts resolved, continuing...'
        : 'Continuing rebase...';
      vscode.window.showInformationMessage(message);
    } else {
      // Normal commit workflow: amend current commit + rebase onto gitorial
      const amendResult = await this.commitOps.amend(message);
      if (amendResult.isErr()) {
        this.emitError(amendResult.error);
        return;
      }

      const rebaseResult = await this.commitOps.rebaseOntoGitorial(checkedOutCommit);
      if (rebaseResult.isErr()) {
        this.emitError(rebaseResult.error);
        return;
      }
      vscode.window.showInformationMessage(`Applied changes to next step: ${stepType}: ${message}`);
    }

    // The RebaseWatcher will automatically detect conflicts or success and send
    // appropriate messages ('commit-editing-conflict' or 'commit-editing-success')
    // to the webview when the rebase state changes.

    // Give the watcher a moment to detect the state change
    await new Promise(resolve => setTimeout(resolve, 100));

    // Refresh the UI to show the updated state
    await this.onRefresh();
  }

  private async handleUnstageFile(filePath: string) {
    const result = await this.fileOps.unstageFile(filePath);
    if (result.isOk()) {
      await this.onRefresh();
    } else {
      this.emitError(result.error);
    }
  }
  private async handleStageAll() {
    const result = await this.fileOps.stageAll();
    if (result.isOk()) {
      await this.onRefresh();
    } else {
      this.emitError(result.error);
    }
  }
  private async handleUnstageAll() {
    const result = await this.fileOps.unstageAll();
    if (result.isOk()) {
      await this.onRefresh();
    } else {
      this.emitError(result.error);
    }
  }
  private async handleOpenDiff(filePath: string) {
    await this.diffOps.openDiff(filePath);
  }
  private async handleOpenFile(filePath: string) {
    await this.navOps.openFile(filePath);
  }
  private async handleDiscardChanges(filePath: string) {
    const fileName = path.basename(filePath);
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to discard changes in ${fileName}?`,
      { modal: true },
      'Discard Changes'
    );
    if (confirm === 'Discard Changes') {
      const result = await this.fileOps.discardChanges(filePath);
      if (result.isOk()) {
        vscode.window.showInformationMessage(`Discarded changes in ${fileName}`);
        await this.onRefresh();
      } else {
        this.emitError(result.error);
      }
    }
  }
  private async handleDiscardAllUnstaged() {
    // Query unstaged changes info first (no side effects)
    const { unstagedCount, unstagedFiles, untrackedFiles } = await this.fileOps.getUnstagedChangesInfo();

    // Early return if no changes to discard
    if (unstagedCount === 0) {
      vscode.window.showInformationMessage('No unstaged changes to discard');
      return;
    }

    // Show confirmation with accurate count
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to discard ALL ${unstagedCount} unstaged change(s)? This action cannot be undone.`,
      { modal: true },
      'Discard All Unstaged'
    );

    if (confirm === 'Discard All Unstaged') {
      const result = await this.fileOps.discardAllUnstaged(unstagedFiles, untrackedFiles);
      if (result.isOk()) {
        await this.onRefresh();
        vscode.window.showInformationMessage('All unstaged changes have been discarded');
      } else {
        this.emitError(result.error);
      }
    }
  }
  private async handleReady() {
    await this.onRefresh();
  }
  private async handleValidate() {
    throw new Error('Not implemented yet');
  }
  private emitError(errorMessage: string) {
    vscode.window.showErrorMessage(errorMessage);
  }
}
