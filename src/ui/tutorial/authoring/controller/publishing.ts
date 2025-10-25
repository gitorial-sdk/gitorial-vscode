import * as Storage from './storage';
import { IGitOperationsFactory } from '@domain/ports/IGitOperationsFactory';
import { IActiveTutorialStateRepository } from 'src/domain/repositories/IActiveTutorialStateRepository';
import { SystemController } from '@ui/system/SystemController';
import { ok, Result } from 'neverthrow';
import { UI } from '@gitorial/shared-types';
import { IClearable } from '.';

export class Controller implements IClearable {
  constructor(
    private readonly storageController: Storage.Controller,
    private readonly gitFactory: IGitOperationsFactory,
    private readonly workspacePath: string,
    private readonly activeTutorialStateRepository: IActiveTutorialStateRepository,
    private readonly systemController: SystemController
  ) {}

  async clearCachedData(): Promise<void> {
    return Promise.resolve();
  }

  async handleMessage(
    message: Extract<UI.Messages.WebviewToExtensionAuthorMessage, { type: 'publishTutorial' | 'previewTutorial' }>
  ): Promise<Result<void, string>> {

    switch (message.type) {
      case 'publishTutorial':
        await this.handlePublishTutorial();
        break;
      case 'previewTutorial':
        await this.handlePreviewTutorial();
        break;
    }

    return ok(void 0);
  }

  private async handlePublishTutorial(): Promise<void> {
    console.log('AuthorModeController: Publish tutorial');

    /*
    const manifest = await this.storageController.getOrLoadManifest();
    try {
      const git = this.gitFactory.fromPath(this.workspacePath);

      const steps = manifest.steps.map(s => ({
        commit : s.commit,
        type   : s.type,
        title  : s.title,
      }));

      // Use step-isolation-friendly rebuild method that preserves step isolation
      await git.rebuildGitorialBranchFromManifest(steps);

      // Clear persisted tutorial state since step IDs will change after republishing
      console.log('AuthorModeController: Clearing persisted tutorial state after successful publish');
      await this.activeTutorialStateRepository.clearActiveTutorial();

      // Force refresh the tutorial UI to show the reordered steps
      console.log('AuthorModeController: Forcing tutorial refresh after republishing');
      await this.systemController.forceRefreshTutorial();

      await this.systemController.sendPublishResult(true);
    } catch (e: any) {
      await this.systemController.sendPublishResult(false, e?.message ?? String(e));
    }
      */
  }
  private async handlePreviewTutorial(): Promise<void> {
    console.log('AuthorModeController: Preview tutorial (basic implementation)');
    await this.systemController.sendValidationWarnings(['This is a basic implementation']);
  }
}
