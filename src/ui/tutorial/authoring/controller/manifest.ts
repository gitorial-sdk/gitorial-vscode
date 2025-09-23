import { Domain, UI } from '@gitorial/shared-types';
import { SystemController } from '@ui/system/SystemController';
import { err, ok, Result } from 'neverthrow';
import { CommitHashSanitizer } from 'src/utils/git/CommitHashSanitizer';
import { IClearable } from '.';
import { DEFAULT } from '@domain/services/authoring/manifest/backup';
import { IManifestRepository } from '@domain/ports/IManifestRepository';
import { IManifestBuilder } from '@domain/ports/IManifestBuilder';

export class Controller implements IClearable {
  constructor(
    private readonly systemController: SystemController,
    private readonly workspacePath: string,
    private readonly backupService: IManifestRepository,
    private readonly builderService: IManifestBuilder
  ) {}
  currentManifest: Domain.AuthorManifestData | null = null;

  async clearCachedData(): Promise<void> {
    this.currentManifest = null;
  }

  async handleMessage(
    message: Extract<UI.Messages.WebviewToExtensionAuthorMessage, { type: 'loadManifest' | 'saveManifest' }>
  ): Promise<Result<void, string>> {
    switch (message.type) {
      case 'loadManifest':
        await this.load();
        break;
      case 'saveManifest':
        await this.save(message.payload.manifest);
        break;
      default:
        return err(`Unknown message type: ${message}`);
    }
    return ok(void 0);
  }

  async load(): Promise<void> {
    console.log('AuthorModeController: Load manifest');

    let manifest = (await this.backupService.get(this.workspacePath)).unwrapOr(await this.readManifestOrImport());

    this.currentManifest = manifest;
    await this.systemController.sendAuthorManifest(manifest, false);
  }

  async save(manifest: Domain.AuthorManifestData): Promise<void> {
    console.log('AuthorModeController: Save manifest');

    const sanitizedManifest: Domain.AuthorManifestData = {
      ...manifest,
      steps : manifest.steps.map(step => {
        CommitHashSanitizer.logIfMalformed(step.commit, 'AuthorMode-Save');
        return CommitHashSanitizer.sanitizeManifestStep(step);
      }),
    };

    await this.backupService.save(this.workspacePath, sanitizedManifest);
    this.currentManifest = sanitizedManifest;
  }

  async read(): Promise<Domain.AuthorManifestData> {
    const manifest = await this.backupService.get(this.workspacePath);
    return manifest.unwrapOr(DEFAULT);
  }

  async readManifestOrImport(): Promise<Domain.AuthorManifestData> {
    console.log('🔍 AuthorModeController: readManifestOrImport called');

    const existing = await this.read();
    console.log('🔍 AuthorModeController: Read existing manifest with', existing.steps.length, 'steps');

    if (existing.steps.length > 0) {
      console.log('🔍 AuthorModeController: Using existing manifest with steps');
      return existing;
    }
    const buildResult = await this.builderService.create(this.workspacePath);
    if (buildResult.isErr()) {
      console.error('Authoring > AuthoringManifest > BuilderService Failed');
      console.error(buildResult._unsafeUnwrapErr());
    }
    return buildResult.unwrapOr(DEFAULT);
  }

  /**
   * either returns the persistently stored manifest or a default
   * @returns
   */
  async getOrLoadManifest(): Promise<Domain.AuthorManifestData> {
    console.log('🔍 AuthorModeController: getOrLoadManifest called');

    if (this.currentManifest) {
      console.log('🔍 AuthorModeController: Returning cached manifest with', this.currentManifest.steps.length, 'steps');
      return this.currentManifest;
    }

    console.log('🔍 AuthorModeController: Loading manifest from disk...');
    this.currentManifest = await this.read();
    console.log('🔍 AuthorModeController: Loaded manifest with', this.currentManifest.steps.length, 'steps');
    return this.currentManifest;
  }
}
