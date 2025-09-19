import { IClearable } from '.';
import { UI } from '@gitorial/shared-types';

export class Controller implements IClearable {
  clearCachedData(): Promise<void> {
    return Promise.resolve();
  }

  async handleMessage(_message: Extract<UI.Messages.WebviewToExtensionAuthorMessage, { type: 'validateCommit' }>): Promise<void> {
    await this.validateCommit();
  }

  private async validateCommit(): Promise<void> {
    console.log('AuthorModeController: Validate commit (basic implementation)');
  }
}
