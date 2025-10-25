import { Domain, UI } from '@gitorial/shared-types';
import { SystemController } from '@ui/system/SystemController';
import { err, ok, Result } from 'neverthrow';
import { IClearable } from '.';
import { TutorialAuthoringService } from '@domain/services/authoring/TutorialAuthoringService';

export class Controller implements IClearable {
  constructor(
    private readonly systemController: SystemController,
    private readonly workspacePath: string,
    private readonly tutorialAuthoringService: TutorialAuthoringService
  ) {}

  async clearCachedData(): Promise<void> {
    // TODO: Clear any cached draft data when needed
  }

  async handleMessage(
    message: Extract<UI.Messages.WebviewToExtensionAuthorMessage, { type: 'loadManifest' | 'saveManifest' }>
  ): Promise<Result<void, string>> {
    switch (message.type) {
      case 'loadManifest':
        await this.load();
        break;
      case 'saveManifest':
        // TODO: Replace with proper commit-list save message
        //await this.saveLegacy(message.payload.manifest);
        break;
      default:
        return err(`Unknown message type: ${message}`);
    }
    return ok(void 0);
  }

  async load(): Promise<void> {
    console.log('AuthorModeController: Load draft via service');

    const draftRes = await this.tutorialAuthoringService.loadDraftCommitList(this.workspacePath);
    if (draftRes.isErr()) {
      console.error('AuthoringService.loadDraftCommitList failed:', draftRes.error);
      await this.systemController.userInteraction.showErrorMessage(`Failed to load draft: ${JSON.stringify(draftRes.error)}`);
      return;
    }

    const { location, list: _list } = draftRes.value;
    console.log('AuthorModeController: Loaded draft from', location);

    // TODO: Send proper webview message for draft/commit-list
    // For now, send empty manifest to maintain webview compatibility
    const emptyManifest: Domain.AuthorManifestData = {
      authoringBranch : 'main',
      publishBranch   : 'gitorial',
      steps           : [],
    };
    await this.systemController.sendAuthorManifest(emptyManifest, false);
  }

  // TODO: Add new methods that work directly with DraftCommitList
  async saveDraft(commits: Domain.Commit.Base[]): Promise<void> {
    console.log('AuthorModeController: Save draft commits');

    const res = await this.tutorialAuthoringService.saveDraftCommitList(commits);
    if (res.isErr()) {
      console.error('AuthoringService.saveDraftCommitList failed:', res.error);
      await this.systemController.userInteraction.showErrorMessage(`Failed to save draft: ${JSON.stringify(res.error)}`);
      return;
    }

    console.log('AuthorModeController: Draft saved successfully');
  }

}
