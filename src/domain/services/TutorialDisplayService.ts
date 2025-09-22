import { TutorialViewModelConverter } from '@domain/converters/TutorialViewModelConverter';
import { DiffService } from './DiffService/';
import { Tutorial } from '@domain/models/Tutorial';
import { UI } from '@gitorial/shared-types';

import { TutorialChangeDetector, TutorialViewChangeType } from '@domain/utils/TutorialChangeDetector';

export type TutorialDisplayResult = {
  viewModel      : UI.ViewModels.Tutorial;
  filesToDisplay : string[];
};

/**
 * Domain service responsible for preparing tutorial data for display.
 * Handles business logic for tutorial rendering without UI concerns.
 *
 * Note: Currently depends on IGitChanges from UI layer - this is a temporary
 * architectural compromise that should be resolved by moving IGitChanges to domain layer.
 */
export class TutorialDisplayService {
  private readonly changeDetector: TutorialChangeDetector;

  constructor(
    private readonly viewModelConverter: TutorialViewModelConverter,
    private readonly diffService: DiffService
  ) {
    this.changeDetector = new TutorialChangeDetector();
  }

  public async prepareTutorialDisplay(tutorial: Readonly<Tutorial>): Promise<TutorialDisplayResult> {
    const viewModel = this.viewModelConverter.convert(tutorial);

    const result = await this.diffService.getFiles(
      tutorial.activeStep.commitHash,
      viewModel.isShowingSolution ? 'solution-change' : 'step-change'
    );

    if (result.isErr()) {
      throw new Error(`Error: ${result._unsafeUnwrapErr()}`);
    }
    const relativeFilePaths = result.value.map(f => f.relativePath);

    return {
      viewModel,
      filesToDisplay : relativeFilePaths,
    };
  }

  public async detectDisplayChanges(
    current: UI.ViewModels.Tutorial,
    previous: UI.ViewModels.Tutorial
  ): Promise<TutorialViewChangeType> {
    return this.changeDetector.detectChange(current, previous);
  }
}
