import { Tutorial } from 'src/domain/models/Tutorial';
import { DiffModel } from '../../models/DiffModel';
import { IDiffDisplayer } from 'src/ui/ports/IDiffDisplayer';
import { IFileSystem } from 'src/domain/ports/IFileSystem';
import { Fetcher } from './Fetcher';
import { Filter } from './Filter';
import { err, ok, Result } from 'neverthrow';
import { Converter } from './Converter';
import { Renderer } from './Renderer';
import { GitChangesFactory } from '@infra/factories/GitChangesFactory';

/**
 * Main service for handling diff operations in tutorials.
 * Orchestrates fetching, filtering, converting, and rendering of file diffs.
 */
export class DiffService {
  private fetcher: Fetcher;
  private renderer: Renderer;

  constructor(diffView: IDiffDisplayer, fs: IFileSystem, gitChangesFactory: GitChangesFactory, workspacePath: string) {
    this.fetcher = new Fetcher(gitChangesFactory, workspacePath);
    this.renderer = new Renderer(fs, this.fetcher, diffView);
  }

  /** Get filtered files for manifest building - returns both all valid files and learning marker subset */
  public async getFiles(
    commitHash: string,
    context: 'manifest'
  ): Promise<Result<{ changedFiles: DiffModel[]; learningMarkerFiles: DiffModel[] }, unknown>>;

  /** Get filtered files for step navigation and solution display */
  public async getFiles(commitHash: string, context: 'step-change' | 'solution-change'): Promise<Result<DiffModel[], unknown>>;

  public async getFiles(
    commitHash: string,
    context: 'step-change' | 'solution-change' | 'manifest'
  ): Promise<Result<DiffModel[] | { changedFiles: DiffModel[]; learningMarkerFiles: DiffModel[] }, unknown>> {
    const result = await this.fetcher.getDiffFilePayloads(commitHash);
    if (result.isErr()) {
      return err(result.error);
    }

    const payload = result.value;

    if (context === 'step-change') {
      const filteredPayload = new Filter(payload)
        .removeBuildArtifacts()
        .keepOnlyLearningMarkers()
        .removeRootReadmeFile()
        .filter();

      return ok(Converter.convert(filteredPayload));

    } else if (context === 'solution-change') {
      const filteredPayload = new Filter(payload)
        .removeBuildArtifacts()
        .removeRootReadmeFile()
        .filter();

      return ok(Converter.convert(filteredPayload));

    } else if (context === 'manifest') {
      // All valid files (no README, no noise files)
      const allValidFiles = new Filter(payload)
        .removeBuildArtifacts()
        .removeRootReadmeFile()
        .filter();

      // Subset with learning markers only
      const learningMarkerFiles = new Filter([...allValidFiles])
        .keepOnlyLearningMarkers()
        .filter();

      return ok({
        changedFiles        : Converter.convert(allValidFiles),
        learningMarkerFiles : Converter.convert(learningMarkerFiles),
      });
    }

    return err(`Uncaught Context has been provided.\nContext: '${context}'`);
  }

  /** Display solution diff for the next tutorial step */
  public async showStepSolution(
    tutorial: Readonly<Tutorial>,
    preferredFocusFile?: string
  ): ReturnType<typeof this.renderer.showStepSolution> {
    return this.renderer.showStepSolution(tutorial, preferredFocusFile);
  }

}
