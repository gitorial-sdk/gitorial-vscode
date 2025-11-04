import type { UI, Domain } from '@gitorial/shared-types';

export interface SidebarState {
  stepType            : Domain.Commit.Type;
  stepMessage         : string;
  stagedFiles         : Array<{ path: string; status: string }>;
  unstagedFiles       : Array<{ path: string; status: string }>;
  mergeFiles          : Array<{ path: string; status: string }>;
  mergeCollapsed      : boolean;
  stagedCollapsed     : boolean;
  changesCollapsed    : boolean;
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
        break;
      case 'commit-editing-conflict':
        sidebarState.commitEditingStatus = 'Conflict';
        sidebarState.mergeFiles = message.payload.mergeFiles;
        break;
      case 'commit-editing-success':
        sidebarState.commitEditingStatus = 'Success';
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

  validate() {},
} as const;
