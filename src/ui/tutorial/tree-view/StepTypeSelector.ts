import { IGitOperations } from '@domain/ports/IGitOperations';
import { Domain } from '@gitorial/shared-types';

type StepType = Domain.Commit.Type;

/**
 * Handles step type selection and changes
 */
export class StepTypeSelector {
  private currentStepType: StepType = 'action'; // Default
  private currentStepMessage: string = '';
  private onChangeCallback?: () => void;

  constructor(private readonly gitOperations: IGitOperations) {
    this.loadCurrentStepType();
  }

  /**
   * Set a callback to be notified when the step type or message changes
   */
  setOnChangeCallback(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * Load the current step type and message from the currently checked out commit message
   */
  private async loadCurrentStepType(): Promise<void> {
    try {
      const currentCommitHash = await this.gitOperations.getCurrentCommitHash();
      const currentCommitMessage = await this.gitOperations.getCommitMessage(currentCommitHash);
      // Parse commit message to extract type (format: "type: title")
      const match = currentCommitMessage.match(/^(section|template|solution|action|readme):\s*(.+)/i);
      if (match) {
        const newStepType = match[1].toLowerCase() as StepType;
        const newStepMessage = match[2].trim();
        if (newStepType !== this.currentStepType || newStepMessage !== this.currentStepMessage) {
          this.currentStepType = newStepType;
          this.currentStepMessage = newStepMessage;
          if (this.onChangeCallback) this.onChangeCallback();
        }
      }
    } catch (error) {
      console.error('Failed to load current step type:', error);
    }
  }

  /**
   * Reload the step type and message from the currently checked out commit
   */
  async reloadFromCurrentCommit(): Promise<void> {
    await this.loadCurrentStepType();
  }

  /**
   * Get the current step type
   */
  getCurrentStepType(): StepType {
    return this.currentStepType;
  }

  /**
   * Get the current step message
   */
  getCurrentStepMessage(): string {
    return this.currentStepMessage || 'Enter step title...';
  }

}
