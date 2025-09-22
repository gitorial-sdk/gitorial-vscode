import { IClearable } from '.';
import { Domain, UI } from '@gitorial/shared-types';

export class Controller implements IClearable {
  clearCachedData(): Promise<void> {
    return Promise.resolve();
  }

  async handleMessage(_message: Extract<UI.Messages.WebviewToExtensionAuthorMessage, { type: 'validateCommit' }>): Promise<void> {
    await this.validateCommit();
  }

  private async validateCommit(): Promise<void> {
    //todo: validate commits
    console.log('AuthorModeController: Validate commit (basic implementation)');
    const exampleCommit = Domain.Commit.V1.Validator.buildCommitFromMessage(
      'template: Implement feature',
      'abc123HASH',
      ['README.md'],
      []
    )
      ._unsafeUnwrap();
    Domain.Commit.V1.Validator.validateContent(exampleCommit);
  }
}
