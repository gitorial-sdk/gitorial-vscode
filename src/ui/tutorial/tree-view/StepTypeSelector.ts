import * as vscode from 'vscode';
import { IGitOperations } from '@domain/ports/IGitOperations';
import { Domain } from '@gitorial/shared-types';

type StepType = Domain.Commit.Type;

const STEP_TYPE_LABELS: Record<StepType, { label: string; description: string; icon: string }> = {
  section : {
    label       : 'Section',
    description : 'A new section or chapter in the tutorial',
    icon        : '📖',
  },
  template : {
    label       : 'Template',
    description : 'Starting point that will be followed by a solution',
    icon        : '📝',
  },
  solution : {
    label       : 'Solution',
    description : 'Solution to a template or action',
    icon        : '✅',
  },
  action : {
    label       : 'Action',
    description : 'An action or instruction for the user',
    icon        : '⚡',
  },
  readme : {
    label       : 'Readme',
    description : 'README or documentation update',
    icon        : '📄',
  },
};

/**
 * Handles step type selection and changes
 */
export class StepTypeSelector {
  private currentStepType: StepType = 'action'; // Default
  private currentStepMessage: string = '';
  private onChangeCallback?: () => void;

  constructor(
    private readonly gitOperations: IGitOperations,
    private readonly workspacePath: string
  ) {
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
        if (match) {
          this.currentStepType = match[1].toLowerCase() as StepType;
          this.currentStepMessage = match[2].trim();
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
   * Get a formatted label for the current step type
   */
  getCurrentStepTypeLabel(): string {
    const info = STEP_TYPE_LABELS[this.currentStepType];
    return `${info.icon} ${info.label}`;
  }

  /**
   * Get the current step message
   */
  getCurrentStepMessage(): string {
    return this.currentStepMessage || 'Enter step title...';
  }

  /**
   * Set the current step message
   */
  setCurrentStepMessage(message: string): void {
    this.currentStepMessage = message;
    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }

  /**
   * Show a QuickPick to select a new step type
   */
  async selectStepType(): Promise<void> {
    const items: vscode.QuickPickItem[] = Object.entries(STEP_TYPE_LABELS)
      .map(([type, info]) => ({
        label       : `${info.icon} ${info.label}`,
        description : info.description,
        detail      : type === this.currentStepType ? '(current)' : undefined,
        // Store the type in the item for later retrieval
        ...({ type } as any),
      }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder : 'Select the step type for your next commit',
      title       : 'Change Step Type',
    });

    if (selected) {
      // Extract the type from the label
      const selectedType = Object.entries(STEP_TYPE_LABELS)
        .find(([_, info]) => `${info.icon} ${info.label}` === selected.label)?.[0] as StepType;

      if (selectedType) {
        this.currentStepType = selectedType;
        if (this.onChangeCallback) {
          this.onChangeCallback();
        }
        vscode.window.showInformationMessage(`Step type changed to: ${STEP_TYPE_LABELS[selectedType].label}`);
      }
    }
  }

  /**
   * Show an input box to edit the step message
   */
  async editStepMessage(): Promise<void> {
    const result = await vscode.window.showInputBox({
      prompt        : 'Enter the step title/message',
      placeHolder   : 'e.g., Add user authentication',
      value         : this.currentStepMessage,
      validateInput : value => {
        if (!value || value.trim().length === 0) {
          return 'Step message cannot be empty';
        }
        if (value.length > 100) {
          return 'Step message is too long (max 100 characters)';
        }
        return null;
      },
    });

    if (result !== undefined) {
      this.currentStepMessage = result.trim();
      if (this.onChangeCallback) {
        this.onChangeCallback();
      }
    }
  }

  /**
   * Get the full commit message (type: message)
   * @param userMessage Optional message to use instead of the stored one
   */
  getFullCommitMessage(userMessage?: string): string {
    const message = userMessage || this.currentStepMessage;
    return `${this.currentStepType}: ${message}`;
  }

  /**
   * Register the commands for changing step type and editing message
   */
  static register(context: vscode.ExtensionContext, gitOperations: IGitOperations, workspacePath: string): StepTypeSelector {
    const selector = new StepTypeSelector(gitOperations, workspacePath);

    const changeTypeDisposable = vscode.commands.registerCommand('gitorial.changeStepType', () => selector.selectStepType());

    const editMessageDisposable = vscode.commands.registerCommand('gitorial.editStepMessage', () => selector.editStepMessage());

    context.subscriptions.push(changeTypeDisposable, editMessageDisposable);
    return selector;
  }
}
