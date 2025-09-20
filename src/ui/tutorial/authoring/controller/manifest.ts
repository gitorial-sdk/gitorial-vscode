import { Domain, UI } from '@gitorial/shared-types';
import { SystemController } from '@ui/system/SystemController';
import { err, ok, Result } from 'neverthrow';
import { CommitHashSanitizer } from 'src/utils/git/CommitHashSanitizer';
import { IGitOperationsFactory } from '@domain/ports/IGitOperationsFactory';
import { IClearable } from '.';
import { IFileSystem } from '@domain/ports/IFileSystem';
import * as vscode from 'vscode';

export const DEFAULT: Domain.AuthorManifestData = {
  authoringBranch: 'main',
  publishBranch: 'gitorial',
  steps: [],
};

export class Controller implements IClearable {
  constructor(
    private readonly systemController: SystemController,
    private readonly gitFactory: IGitOperationsFactory,
    private readonly fs: IFileSystem,
    private readonly workspacePath: string
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

    let manifest = await this.read();

    if (manifest.steps.length === 0) {
      const backup = this.systemController.getAuthorManifestBackup(this.workspacePath);
      if (backup) {
        console.log(`🔍 AuthorMode: Found backup manifest with ${backup.steps.length} steps`);
        // CRITICAL FIX: Validate backup manifest commit hashes to prevent corruption
        let hasCorruptedHashes = false;
        for (const step of backup.steps) {
          if (step.commit.length !== 40 || step.commit.includes('HEAD.') || step.commit.includes('.c74')) {
            console.error(
              `🚨 AuthorMode: CORRUPTED HASH DETECTED in backup manifest: "${step.commit}" in step "${step.title}"`
            );
            hasCorruptedHashes = true;
            break;
          }
        }

        if (hasCorruptedHashes) {
          console.log(
            '🚨 AuthorMode: Backup manifest contains corrupted hashes - forcing fresh import from gitorial branch'
          );
          manifest = await this.readManifestOrImport();
        } else {
          console.log('✅ AuthorMode: Using validated backup manifest');
          manifest = backup;
        }
      } else {
        console.log('📁 AuthorMode: No backup manifest found - importing from gitorial branch');
        manifest = await this.readManifestOrImport();
      }
    }

    this.currentManifest = manifest;
    await this.systemController.sendAuthorManifest(manifest, false);
  }

  async save(manifest: Domain.AuthorManifestData): Promise<void> {
    console.log('AuthorModeController: Save manifest');

    // Sanitize all commit hashes in the manifest before saving
    const sanitizedManifest: Domain.AuthorManifestData = {
      ...manifest,
      steps: manifest.steps.map(step => {
        CommitHashSanitizer.logIfMalformed(step.commit, 'AuthorMode-Save');
        return CommitHashSanitizer.sanitizeManifestStep(step);
      }),
    };

    const manifestDir = vscode.Uri.joinPath(vscode.Uri.file(this.workspacePath), '.gitorial');
    const manifestUri = vscode.Uri.joinPath(manifestDir, 'manifest.json');

    try {
      await this.fs.createDirectory(manifestDir.fsPath);
    } catch {}

    const content = JSON.stringify(sanitizedManifest, null, 2);
    await this.fs.writeFile(manifestUri.fsPath, content);
    await this.systemController.saveAuthorManifestBackup(this.workspacePath, sanitizedManifest);
  }

  async read(): Promise<Domain.AuthorManifestData> {
    const manifestUri = vscode.Uri.joinPath(vscode.Uri.file(this.workspacePath), '.gitorial', 'manifest.json');

    try {
      const content = await this.fs.readFile(manifestUri.fsPath);
      const json = JSON.parse(Buffer.from(content).toString('utf-8')) as Domain.AuthorManifestData;

      // Sanitize commit hashes when reading existing manifests
      const sanitizedManifest: Domain.AuthorManifestData = {
        ...json,
        steps:
          json.steps?.map(step => {
            CommitHashSanitizer.logIfMalformed(step.commit, 'AuthorMode-Read');
            try {
              return CommitHashSanitizer.sanitizeManifestStep(step);
            } catch (error) {
              console.warn(
                `AuthorModeController: Failed to sanitize commit hash "${step.commit}" in step "${step.title}":`,
                error
              );
              return step; // Return original step if sanitization fails
            }
          }) || [],
      };

      return sanitizedManifest;
    } catch {
      return DEFAULT;
    }
  }

  async readManifestOrImport(): Promise<Domain.AuthorManifestData> {
    console.log('🔍 AuthorModeController: readManifestOrImport called');

    const existing = await this.read();
    console.log('🔍 AuthorModeController: Read existing manifest with', existing.steps.length, 'steps');

    if (existing.steps.length > 0) {
      console.log('🔍 AuthorModeController: Using existing manifest with steps');
      return existing;
    }

    try {
      console.log('🔍 AuthorModeController: Creating git adapter for workspace:', this.workspacePath);
      const git = this.gitFactory.fromPath(this.workspacePath);

      console.log('🔍 AuthorModeController: Getting repo info...');
      const info = await git.getRepoInfo();
      console.log('🔍 AuthorModeController: Current branch:', info.branches.current);
      console.log('🔍 AuthorModeController: Repo info branches:', info.branches.all);

      if (!info.branches.all.includes('gitorial')) {
        console.log('🔍 AuthorModeController: No gitorial branch found, using existing manifest');
        return existing;
      }

      console.log('🔍 AuthorModeController: Getting commits from gitorial branch...');
      const commits = await git.getCommits('gitorial');
      console.log('🔍 AuthorModeController: Found', commits.length, 'commits in gitorial branch');

      const steps: Domain.ManifestStep[] = commits
        .map(c => {
          const msg = c.message.trim();
          for (const type of Domain.STEP_TYPES) {
            const prefix = `${type}:`;
            if (msg.toLowerCase().startsWith(prefix)) {
              const title = msg.slice(prefix.length).trim();
              console.log(`🔍 AuthorModeController: Found step - commit: ${c.hash}, type: ${type}, title: ${title}`);
              return {
                commit: c.hash,
                type,
                title,
              } as Domain.ManifestStep;
            }
          }
          return null;
        })
        .filter((s): s is Domain.ManifestStep => !!s);

      console.log('🔍 AuthorModeController: Created', steps.length, 'steps from gitorial commits');

      const manifest = {
        authoringBranch: info.branches.current || 'main',
        publishBranch: 'gitorial',
        steps: steps.slice().reverse(),
      };

      console.log('🔍 AuthorModeController: Final manifest has', manifest.steps.length, 'steps');
      return manifest;
    } catch (e) {
      console.error('🚨 AuthorModeController: import from gitorial failed:', e);
      console.warn('AuthorModeController: import from gitorial failed, using empty manifest', e);
      return existing;
    }
  }

  async write() {
    if (!this.currentManifest) {
      return;
    }

    const fs = vscode.workspace.fs;
    const dir = vscode.Uri.joinPath(vscode.Uri.file(this.workspacePath), '.gitorial');
    const uri = vscode.Uri.joinPath(dir, 'manifest.json');

    try {
      await fs.createDirectory(dir);
    } catch {}

    await fs.writeFile(uri, new TextEncoder().encode(JSON.stringify(this.currentManifest, null, 2)));
    await this.systemController.saveAuthorManifestBackup(this.workspacePath, this.currentManifest);
  }

  async getOrLoadManifest(): Promise<Domain.AuthorManifestData> {
    console.log('🔍 AuthorModeController: getOrLoadManifest called');

    if (this.currentManifest) {
      console.log(
        '🔍 AuthorModeController: Returning cached manifest with',
        this.currentManifest.steps.length,
        'steps'
      );
      return this.currentManifest;
    }

    console.log('🔍 AuthorModeController: Loading manifest from disk...');
    this.currentManifest = await this.read();
    console.log('🔍 AuthorModeController: Loaded manifest with', this.currentManifest.steps.length, 'steps');
    return this.currentManifest;
  }
}
