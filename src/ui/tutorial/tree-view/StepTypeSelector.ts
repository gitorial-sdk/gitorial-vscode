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
   * Load the current step type and message from the latest commit message
   */
  private async loadCurrentStepType(): Promise<void> {
    try {
      const commits = await this.gitOperations.getCommits();
      if (commits.length > 0) {
        const latestCommit = commits[0];
        // Parse commit message to extract type (format: "type: title")
        const match = latestCommit.message.match(/^(section|template|solution|action|readme):\s*(.+)/i);
        if (match && (match[1].toLowerCase() !== this.currentStepType || match[2].trim() !== this.currentStepMessage)) {
          this.currentStepType = match[1].toLowerCase() as StepType;
          this.currentStepMessage = match[2].trim();
          if (this.onChangeCallback) this.onChangeCallback();
        }
      }
    } catch (error) {
      console.error('Failed to load current step type:', error);
    }
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
