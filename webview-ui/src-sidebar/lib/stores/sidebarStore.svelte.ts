import type { UI, Domain } from '@gitorial/shared-types';

export interface SidebarState {
  stepType            : Domain.Commit.Type;
  stepMessage         : string;
  stagedFiles         : Array<UI.Messages.SourceCodeFile>;
  unstagedFiles       : Array<UI.Messages.SourceCodeFile>;
  mergeFiles          : Array<UI.Messages.SourceCodeFile>;
  mergeCollapsed      : boolean;
  stagedCollapsed     : boolean;
  changesCollapsed    : boolean;
  //TODO              : remove and make a derived property instead
  commitEditingStatus : 'Conflict' | 'Success' | 'Saving' | 'Editing';
}

interface OriginalState {
  stepType    : Domain.Commit.Type;
  stepMessage : string;
}

const initialState: SidebarState = {
  stepType            : 'solution',
  stepMessage         : '',
  stagedFiles         : [],
  unstagedFiles       : [],
  mergeFiles          : [],
  mergeCollapsed      : false,
  stagedCollapsed     : false,
  changesCollapsed    : false,
  commitEditingStatus : 'Editing',
};

let sidebarState = $state<SidebarState>(initialState);
let originalState = $state<OriginalState | null>(null);

export const sidebarStore = {
  get commitEditingStatus() {
    return sidebarState.commitEditingStatus;
  },
  set commitEditingStatus(v) {
    sidebarState.commitEditingStatus = v;
  },
  get stepType() {
    return sidebarState.stepType;
  },
  set stepType(v) {
    sidebarState.stepType = v;
  },
  get stepMessage() {
    return sidebarState.stepMessage;
  },
  set stepMessage(v) {
    sidebarState.stepMessage = v;
  },
  get stagedFiles() {
    return sidebarState.stagedFiles;
  },
  get unstagedFiles() {
    return sidebarState.unstagedFiles;
  },
  get mergeFiles() {
    return sidebarState.mergeFiles;
  },
  get mergeCollapsed() {
    return sidebarState.mergeCollapsed;
  },
  set mergeCollapsed(v) {
    sidebarState.mergeCollapsed = v;
  },
  get stagedCollapsed() {
    return sidebarState.stagedCollapsed;
  },
  set stagedCollapsed(v) {
    sidebarState.stagedCollapsed = v;
  },
  get changesCollapsed() {
    return sidebarState.changesCollapsed;
  },
  set changesCollapsed(v) {
    sidebarState.changesCollapsed = v;
  },

  handleMessage(message: UI.Messages.ExtensionToSidebarMessage) {
    switch (message.type) {
      case 'data-update':
        originalState = message.payload;
        sidebarState = { ...sidebarState, ...message.payload };
        break;
      case 'file-data-update':
        sidebarState = { ...sidebarState, ...message.payload };
        if (message.payload.mergeFiles.length > 0) {
          sidebarState.commitEditingStatus = 'Conflict';
        } else if (sidebarState.commitEditingStatus === 'Conflict') {
          sidebarState.commitEditingStatus = 'Editing';
        }
        break;
      case 'commit-editing-conflict':
        sidebarState.commitEditingStatus = 'Conflict';

        sidebarState.mergeFiles = message.payload.mergeFiles;
        sidebarState.stepType = message.payload.stepType;
        sidebarState.stepMessage = message.payload.stepMessage;

        originalState = {
          stepType    : message.payload.stepType,
          stepMessage : message.payload.stepMessage,
        };
        break;
      case 'commit-editing-success':
        this.setSuccessStatusWithTimeout();
        break;
      default:
        console.warn('Unknown message received: ', message);
    }
  },

  // Computed property to check if anything has changed
  get hasChanges(): boolean {
    // Always enable if there are staged files
    if (sidebarState.stagedFiles.length > 0) {
      return true;
    }

    // Check if original state exists (data has been loaded)
    if (!originalState) {
      return false;
    }

    // Check if step type or step message has changed
    return sidebarState.stepType !== originalState.stepType || sidebarState.stepMessage.trim() !== originalState.stepMessage.trim()
  },

  setSuccessStatusWithTimeout() {
    sidebarState.commitEditingStatus = 'Success';
    setTimeout(() => {
      sidebarState.commitEditingStatus = 'Editing';
    }, 3000);
  },

  validate() {},
} as const;
