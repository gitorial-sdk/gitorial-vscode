import { Tutorial } from '@domain/models/Tutorial';
import { IFileSystem } from '@domain/ports/IFileSystem';
import { DiffFile, IDiffDisplayer } from '@ui/ports/IDiffDisplayer';
import { DiffFilePayload } from '@ui/ports/IGitChanges';
import { err, ok, Result } from 'neverthrow';

import { Filter } from './Filter';
import { Fetcher } from './Fetcher';
import { Step } from '@domain/models/Step';
import { EnrichedStep } from '@domain/models/EnrichedStep';

export type RendererError = { type: 'no_next_step' } | { type: 'display_failed'; error: unknown };

/**
 * Renders tutorial solution diffs in VS Code diff viewer.
 * Handles file filtering, content providers, and display orchestration.
 */
export class Renderer {
  constructor(
    private readonly fs: IFileSystem,
    private readonly fetcher: Fetcher,
    private readonly diffDisplayer: IDiffDisplayer
  ) {}

  /** Show solution diff for the next tutorial step */
  public async showStepSolution(tutorial: Readonly<Tutorial>, preferredFocusFile?: string): Promise<Result<void, RendererError>> {
    const nextStep = this._getNextStep(tutorial);
    if (!nextStep) return err({ type: 'no_next_step' });

    const filteredFilesResult = await this._getFilteredFiles(nextStep.commitHash);
    if (filteredFilesResult.isErr()) {
      return err({ type: 'display_failed', error: filteredFilesResult.error });
    }

    const filteredFiles = filteredFilesResult.value;
    if (filteredFiles.length === 0) return ok(void 0); // Nothing to display, successful state

    try {
      const filesToDisplay = this._createDiffFiles(filteredFiles, tutorial, nextStep);
      await this.diffDisplayer.displayDiff(filesToDisplay, preferredFocusFile);
      return ok(void 0);
    } catch (error) {
      return err({ type: 'display_failed', error });
    }
  }

  private _getNextStep(tutorial: Readonly<Tutorial>): Step | EnrichedStep | undefined {
    return tutorial.steps.at(tutorial.activeStepIndex + 1);
  }

  private async _getFilteredFiles(commitHash: string) {
    return (await this.fetcher.getDiffFilePayloads(commitHash)).andThen(files =>
      ok(
        new Filter(files)
          .removeRootReadmeFile()
          .removeBuildArtifacts()
          .filter()
      )
    );
  }

  private _createDiffFiles(
    filteredFiles: DiffFilePayload[],
    tutorial: Readonly<Tutorial>,
    nextStep: Step | EnrichedStep
  ): DiffFile[] {
    return filteredFiles.map(payload => ({
      leftContentProvider  : this._createLeftContentProvider(tutorial, payload),
      rightContentProvider : this._createRightContentProvider(payload),
      relativePath         : payload.relativeFilePath,
      leftCommitId         : 'working-dir',
      rightCommitId        : nextStep.commitHash,
      titleCommitId        : nextStep.commitHash.slice(0, 7),
    }));
  }

  private _createLeftContentProvider(tutorial: Readonly<Tutorial>, payload: DiffFilePayload) {
    return async () => {
      const absoluteFilePath = this.fs.join(tutorial.localPath, payload.relativeFilePath);

      try {
        return (await this.fs.pathExists(absoluteFilePath)) ? await this.fs.readFile(absoluteFilePath) : '';
      } catch (error) {
        console.error(`Error reading current file ${absoluteFilePath}:`, error);
        return `// Error reading current file: ${error}`;
      }
    };
  }

  private _createRightContentProvider(payload: DiffFilePayload) {
    return async () => payload.modifiedContent || '';
  }
}
