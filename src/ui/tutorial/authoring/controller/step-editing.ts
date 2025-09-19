import { err, ok, Result } from 'neverthrow';
import * as Manifest from './manifest';
import { Domain, UI } from '@gitorial/shared-types';
import { SystemController } from '@ui/system/SystemController';
import { CommitHashSanitizer } from 'src/utils/git/CommitHashSanitizer';
import * as vscode from 'vscode';
import { IGitOperationsFactory } from '@domain/ports/IGitOperationsFactory';
import { IClearable } from '.';

export class Controller implements IClearable {
  private currentlyEditingStep: number | null = null;
  private originalStepCommit: string | null = null;
  private saveListenerDisposable: vscode.Disposable | null = null;

  constructor(private readonly systemController: SystemController,
    private readonly manifestController: Manifest.Controller,
    private readonly gitFactory: IGitOperationsFactory,
    private readonly currentWorkspace: string,
  ) {
    this.gitFactory = gitFactory;
  }

  async clearCachedData(): Promise<void> {
    this.currentlyEditingStep = null;
    this.originalStepCommit = null;
    if (this.saveListenerDisposable) {
      this.saveListenerDisposable.dispose();
      this.saveListenerDisposable = null;
    }
  }


  async handleMessage(message: Extract<
    UI.Messages.WebviewToExtensionAuthorMessage,
    { type: 'addStep' | 'removeStep' | 'updateStep' | 'reorderStep' | 'startEditingStep' | 'saveStepChanges' | 'cancelStepEditing' }
    >): Promise<Result<void, string>> {
    switch (message.type) {
      case 'addStep':
        await this.add(message.payload.step, message.payload.index);
        break;
      case 'removeStep':
        await this.remove(message.payload.index);
        break;
      case 'updateStep':
        await this.update(message.payload.index, message.payload.step);
        break;
      case 'reorderStep':
        await this.reorder(message.payload.fromIndex, message.payload.toIndex);
        break;
      case 'startEditingStep':
        await this.edit(message.payload.stepIndex);
        break;
      case 'saveStepChanges':
        await this.save(message.payload.stepIndex);
        break;
      case 'cancelStepEditing':
        await this.cancel(message.payload.stepIndex);
        break;
      default:
        return err(`Unknown message type: ${message}`);
    }

    return ok(void 0);
  }

  private async add(step: Domain.ManifestStep, index?: number): Promise<void> {
    console.log('AuthorModeController: Add step');
    const manifest = await this.manifestController.getOrLoadManifest();
    const steps = [...manifest.steps];
    const insertAt = typeof index === 'number' && index >= 0 && index <= steps.length ? index : steps.length;
    steps.splice(insertAt, 0, step);
    this.manifestController.currentManifest = { ...manifest, steps };
    await this.manifestController.write();
  }

  private async remove(index: number): Promise<void> {
    console.log('AuthorModeController: Remove step');
    const manifest = await this.manifestController.getOrLoadManifest();
    if (index < 0 || index >= manifest.steps.length) {
      return;
    }

    const steps = manifest.steps.filter((_, i) => i !== index);
    this.manifestController.currentManifest = { ...manifest, steps };
    await this.manifestController.write();
  }

  private async update(index: number, step: Domain.ManifestStep): Promise<void> {
    console.log('AuthorModeController: Update step');
    const manifest = await this.manifestController.getOrLoadManifest();
    if (index < 0 || index >= manifest.steps.length) {
      return;
    }

    const steps = [...manifest.steps];
    steps[index] = step;
    this.manifestController.currentManifest = { ...manifest, steps };
    await this.manifestController.write();
  }

  private async reorder(fromIndex: number, toIndex: number): Promise<void> {
    console.log('AuthorModeController: Reorder step');
    const manifest = await this.manifestController.getOrLoadManifest();
    if (fromIndex === toIndex ||
            fromIndex < 0 || fromIndex >= manifest.steps.length ||
            toIndex < 0 || toIndex >= manifest.steps.length) {
      return;
    }

    const steps = [...manifest.steps];
    const [moved] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, moved);
    this.manifestController.currentManifest = { ...manifest, steps };
    await this.manifestController.write();
  }

  private async edit(stepIndex: number): Promise<void> {
    console.log('🔍 AuthorModeController: Start editing step', stepIndex);

    try {
      // Validation checks
      if (this.currentlyEditingStep !== null) {
        console.log('🚨 AuthorModeController: Another step is currently being edited');
        await this.systemController.sendEditingError(stepIndex, 'Another step is currently being edited');
        return;
      }

      console.log('🔍 AuthorModeController: Loading manifest...');
      const manifest = await this.manifestController.getOrLoadManifest();
      console.log(`🔍 AuthorModeController: Manifest loaded with ${manifest.steps.length} steps`);

      if (stepIndex < 0 || stepIndex >= manifest.steps.length) {
        console.log(`🚨 AuthorModeController: Invalid step index ${stepIndex}, manifest has ${manifest.steps.length} steps`);
        await this.systemController.sendEditingError(stepIndex, 'Invalid step index');
        return;
      }

      if (!this.currentWorkspace) {
        console.log('🚨 AuthorModeController: No workspace available');
        await this.systemController.sendEditingError(stepIndex, 'No workspace available');
        return;
      }

      const step = manifest.steps[stepIndex];
      console.log(`🔍 AuthorModeController: Step ${stepIndex} details:`, {
        title: step.title,
        type: step.type,
        commit: step.commit,
      });

      // Validate commit hash before attempting checkout
      console.log(`🔍 AuthorMode: Validating commit hash for step ${stepIndex}: "${step.commit}"`);

      // First, sanitize the commit hash
      let sanitizedCommit: string;
      try {
        CommitHashSanitizer.logIfMalformed(step.commit, 'AuthorMode-StartEditing');
        sanitizedCommit = CommitHashSanitizer.sanitize(step.commit);
        console.log(`✅ AuthorMode: Sanitized commit hash: "${sanitizedCommit}"`);
      } catch (sanitizeError) {
        console.error(`🚨 AuthorMode: Invalid commit hash format: "${step.commit}"`, sanitizeError);
        await this.systemController.sendEditingError(
          stepIndex,
          `Invalid commit hash format: ${step.commit}. Please regenerate the manifest from the gitorial branch.`,
        );
        return;
      }

      // Auto-save all unsaved VS Code documents
      console.log('🔍 AuthorModeController: About to ensure clean workspace...');
      await this.ensureCleanWorkspace();
      console.log('✅ AuthorModeController: Clean workspace completed');

      // Get Git adapter and validate commit exists before checkout
      const git = this.gitFactory.fromPath(this.currentWorkspace);

      // Check if commit exists in repository
      try {
        console.log(`🔍 AuthorMode: Verifying commit exists: "${sanitizedCommit}"`);
        await git.getCommitMessage(sanitizedCommit);
        console.log('✅ AuthorMode: Commit exists and is valid');
      } catch (commitError) {
        console.error(`🚨 AuthorMode: Commit does not exist in repository: "${sanitizedCommit}"`, commitError);

        // Try to regenerate manifest from gitorial branch
        console.log('🔄 AuthorMode: Attempting to regenerate manifest from gitorial branch...');
        try {
          const freshManifest = await this.manifestController.readManifestOrImport(this.currentWorkspace);
          this.manifestController.currentManifest = freshManifest;
          await this.systemController.sendAuthorManifest(freshManifest, false);

          // Check if the regenerated manifest has valid steps
          if (freshManifest.steps.length > stepIndex) {
            const newStep = freshManifest.steps[stepIndex];
            console.log(`🔄 AuthorMode: Using regenerated step commit: "${newStep.commit}"`);
            sanitizedCommit = CommitHashSanitizer.sanitize(newStep.commit);
          } else {
            await this.systemController.sendEditingError(
              stepIndex,
              `Step ${stepIndex + 1} not found in regenerated manifest. The gitorial branch may be incomplete.`,
            );
            return;
          }
        } catch (regenerateError) {
          console.error('🚨 AuthorMode: Failed to regenerate manifest:', regenerateError);
          await this.systemController.sendEditingError(
            stepIndex,
            `Commit "${sanitizedCommit}" does not exist. Failed to regenerate manifest: ${regenerateError instanceof Error ? regenerateError.message : String(regenerateError)}`,
          );
          return;
        }
      }

      // Now attempt the checkout with the validated commit
      try {
        console.log(`🔄 AuthorMode: Checking out commit: "${sanitizedCommit}"`);
        await git.checkout(sanitizedCommit);
        console.log('✅ AuthorMode: Successfully checked out commit');
      } catch (checkoutError) {
        console.error(`🚨 AuthorMode: Failed to checkout commit: "${sanitizedCommit}"`, checkoutError);
        await this.systemController.sendEditingError(
          stepIndex,
          `Failed to checkout commit "${sanitizedCommit}": ${checkoutError instanceof Error ? checkoutError.message : String(checkoutError)}`,
        );
        return;
      }

      // Store editing state
      this.currentlyEditingStep = stepIndex;
      this.originalStepCommit = step.commit;

      // Listen for document saves while editing so the webview can enable the Save button
      this.saveListenerDisposable = vscode.workspace.onDidSaveTextDocument(async(_doc) => {
        try {
          if (this.currentlyEditingStep !== null) {
            // Notify webview so UI reflects unsaved changes; user must click Save in the panel
            await this.systemController.sendEditingFileSaved(this.currentlyEditingStep);
          }
        } catch (e) {
          console.warn('AuthorModeController: Error notifying webview of file save', e);
        }
      });

      // Send success response
      await this.systemController.sendEditingStarted(stepIndex, step);

    } catch (error) {
      console.error('🚨 AuthorModeController: Error starting step editing:', error);
      console.error('🚨 AuthorModeController: Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack trace',
        stepIndex,
        currentManifest: this.manifestController.currentManifest ? {
          steps: this.manifestController.currentManifest.steps.map(s => ({ title: s.title, commit: s.commit })),
        } : 'No manifest loaded',
      });
      await this.systemController.sendEditingError(
        stepIndex,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async ensureCleanWorkspace(): Promise<void> {
    console.log('AuthorModeController: Ensuring clean workspace');

    // Auto-save all unsaved documents
    const success = await vscode.workspace.saveAll();
    if (!success) {
      console.warn('AuthorModeController: Some documents could not be auto-saved');
    }

    // Wait a moment for save operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async save(stepIndex: number): Promise<void> {
    console.log('AuthorModeController: Save step changes', stepIndex);

    try {
      // Validation checks
      if (this.currentlyEditingStep !== stepIndex) {
        await this.systemController.sendEditingError(stepIndex, 'This step is not currently being edited');
        return;
      }

      const workspace = this.currentWorkspace;
      if (!workspace) {
        await this.systemController.sendEditingError(stepIndex, 'No workspace available');
        return;
      }

      const manifest = await this.manifestController.getOrLoadManifest();
      if (stepIndex < 0 || stepIndex >= manifest.steps.length) {
        await this.systemController.sendEditingError(stepIndex, 'Invalid step index');
        return;
      }

      // Get Git adapter and create new commit with current changes
      const git = this.gitFactory.fromPath(workspace);

      // Stage all changes and create commit
      await git.stageAllChanges();
      const step = manifest.steps[stepIndex];
      const commitMessage = `${step.type}: ${step.title}`;
      const rawCommitHash = await git.createCommit(commitMessage);

      // Sanitize the new commit hash before using it
      console.log(`🔍 AuthorMode: Raw commit hash from createCommit: "${rawCommitHash}"`);
      CommitHashSanitizer.logIfMalformed(rawCommitHash, 'AuthorMode-CreateCommit');
      const newCommitHash = CommitHashSanitizer.sanitize(rawCommitHash);
      console.log(`🔍 AuthorMode: Sanitized commit hash: "${newCommitHash}"`);

      // NEW APPROACH: Simply update the manifest with the new commit hash
      // Don't modify the gitorial branch during editing - only during publishing
      console.log('✅ AuthorMode: Using simple manifest-only update approach');
      console.log(`📝 AuthorMode: Updating step ${stepIndex + 1} manifest with new commit: ${newCommitHash}`);
      console.log('🔒 AuthorMode: Gitorial branch remains unchanged until publish');

      // Update only the modified step in the manifest - leave all other steps unchanged
      const finalUpdatedSteps = [...manifest.steps];
      finalUpdatedSteps[stepIndex] = { ...step, commit: newCommitHash };

      const finalManifest: Domain.AuthorManifestData = { ...manifest, steps: finalUpdatedSteps };

      // Update our stored manifest with the new commit hash
      this.manifestController.currentManifest = finalManifest;
      await this.manifestController.write();

      // Clear editing state
      this.currentlyEditingStep = null;
      this.originalStepCommit = null;

      // Dispose save listener if any
      if (this.saveListenerDisposable) {
        this.saveListenerDisposable.dispose();
        this.saveListenerDisposable = null;
      }

      // Send success response with the updated manifest
      await this.systemController.sendEditingSaved(stepIndex, finalManifest);

    } catch (error) {
      console.error('AuthorModeController: Error saving step changes:', error);
      await this.systemController.sendEditingError(
        stepIndex,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async cancel(stepIndex: number): Promise<void> {
    console.log('AuthorModeController: Cancel step editing', stepIndex);

    try {
      // Validation checks
      if (this.currentlyEditingStep !== stepIndex) {
        await this.systemController.sendEditingError(stepIndex, 'This step is not currently being edited');
        return;
      }

      const workspace = this.currentWorkspace;
      if (!workspace) {
        await this.systemController.sendEditingError(stepIndex, 'No workspace available');
        return;
      }

      // Reset working directory to clean state
      const git = this.gitFactory.fromPath(workspace);
      await git.resetWorkingDirectory(true);

      // Checkout gitorial branch HEAD
      await git.checkout('gitorial');

      // Clear editing state
      this.currentlyEditingStep = null;
      this.originalStepCommit = null;

      // Dispose save listener if any
      if (this.saveListenerDisposable) {
        this.saveListenerDisposable.dispose();
        this.saveListenerDisposable = null;
      }

      // Send success response
      await this.systemController.sendEditingCancelled(stepIndex);

    } catch (error) {
      console.error('AuthorModeController: Error cancelling step editing:', error);

      // Clear editing state even on error
      this.currentlyEditingStep = null;
      this.originalStepCommit = null;

      await this.systemController.sendEditingError(
        stepIndex,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
