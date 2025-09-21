import { Domain } from '@gitorial/shared-types';
import { IStateStorage } from '@domain/ports/IStateStorage';
import { IManifestBackupService, ManifestBackupServiceError } from '@ui/ports/IManifestBackupService';
import { IFileSystem } from '@domain/ports/IFileSystem';
import { isDevelopmentMode } from 'src/utils/environment';
import { CommitHashSanitizer } from 'src/utils/git/CommitHashSanitizer';
import { err, ok, Result } from 'neverthrow';

const MANIFEST = 'manifest.json';
const MANIFEST_FOLDER = '.gitorial';

export const DEFAULT: Domain.AuthorManifestData = {
  authoringBranch: 'main',
  publishBranch: 'gitorial',
  steps: [],
};

/**
 * Primary manifest storage service using VS Code's persistent storage.
 * In development mode, also writes debug files to disk for inspection.
 */
export class ManifestBackupService implements IManifestBackupService {
  /**
   * Creates a new manifest backup service.
   * @param storage - State storage for persisting manifest data
   * @param fs - Optional file system for debug manifest.json output
   */
  constructor(
    private readonly storage: IStateStorage,
    private readonly fs?: IFileSystem
  ) {}

  public async save(
    repoPath: string,
    manifest: Domain.AuthorManifestData
  ): Promise<Result<void, ManifestBackupServiceError>> {
    const key = this.getBackupKey(repoPath);

    for (const step of manifest.steps) {
      try {
        CommitHashSanitizer.sanitizeManifestStep(step);
        if (this._hasCorruptedHashes(manifest)) {
          throw new Error('corrupted hash error');
        }
      } catch (error) {
        console.warn(`ManifestBackupService: Failed to sanitize commit hash "${step.commit}":`, error);
        this.clear(repoPath);
        return err({ type: 'saniziation_failed' });
      }
    }

    await this.storage.update(key, manifest);
    if (isDevelopmentMode() && this.fs) {
      await this.writeDebugFile(repoPath, manifest);
    }
    return ok();
  }

  public async get(repoPath: string): Promise<Result<Domain.AuthorManifestData, ManifestBackupServiceError>> {
    const key = this.getBackupKey(repoPath);
    let backup = this.storage.get(key, null) as Domain.AuthorManifestData | null;

    if (!backup) {
      return err({ type: 'failed_retrieving' });
    }

    return ok(backup);
  }

  public async clear(repoPath: string): Promise<void> {
    const key = this.getBackupKey(repoPath);
    await this.storage.update(key, undefined);

    if (isDevelopmentMode() && this.fs) {
      await this.clearDebugFile(repoPath);
    }
  }

  private _hasCorruptedHashes(manifest: Domain.AuthorManifestData): boolean {
    const isValid = manifest.steps.some(s => !CommitHashSanitizer.isValid(s.commit));
    if (isValid) {
      return false;
    }
    return manifest.steps.some(
      step => !step.commit || step.commit.length !== 40 || step.commit.includes('HEAD.') || step.commit.includes('.c74') //TODO: Check why HEAD. or .c74 is included here
    );
  }

  private getBackupKey(repoPath: string): string {
    return `authorManifestBackup_${repoPath}`;
  }

  /**
   * Writes manifest to file system for debugging purposes (development mode only).
   */
  private async writeDebugFile(repoPath: string, manifest: Domain.AuthorManifestData): Promise<void> {
    if (!this.fs) {
      return;
    }

    try {
      const dir = this.fs.join(repoPath, MANIFEST_FOLDER);
      const manifestFilePath = this.fs.join(dir, MANIFEST);
      await this.fs.createDirectory(dir);

      const content = JSON.stringify(manifest, null, 2);
      await this.fs.writeFile(manifestFilePath, content);

      console.log('ManifestBackupService: Debug manifest file written to', manifestFilePath);
    } catch (error) {
      console.warn('ManifestBackupService: Failed to write debug file (non-critical):', error);
    }
  }

  /**
   * Clears debug file (development mode only).
   */
  private async clearDebugFile(repoPath: string): Promise<void> {
    if (!this.fs) {
      return;
    }

    try {
      const manifestFolderPath = this.fs.join(repoPath, MANIFEST_FOLDER);
      await this.fs.deleteDirectory(manifestFolderPath);
      console.log('ManifestBackupService: Debug file cleared');
    } catch (error) {
      console.warn('ManifestBackupService: Failed to clear debug file (non-critical):', error);
    }
  }
}
