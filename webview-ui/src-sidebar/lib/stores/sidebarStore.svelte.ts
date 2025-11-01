import type { UI, Domain } from '@gitorial/shared-types';

interface SidebarState {
  stepType         : Domain.Commit.Type;
  stepMessage      : string;
  stagedFiles      : Array<{ path: string; status: string }>;
  unstagedFiles    : Array<{ path: string; status: string }>;
  stagedCollapsed  : boolean;
  changesCollapsed : boolean;
}

interface OriginalState {
  stepType    : Domain.Commit.Type;
  stepMessage : string;
}

const initialState: SidebarState = {
  stepType         : 'solution',
  stepMessage      : '',
  stagedFiles      : [],
  unstagedFiles    : [],
  stagedCollapsed  : false,
  changesCollapsed : false,
};

let sidebarState = $state<SidebarState>(initialState);
let originalState = $state<OriginalState | null>(null);

export const sidebarStore = {
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
        sidebarState = { ...sidebarState, ...message.payload };
        // Store original values when data is first loaded
        if (originalState === null && message.payload.stepType && message.payload.stepMessage) {
          originalState = {
            stepType: message.payload.stepType,
            stepMessage: message.payload.stepMessage,
          };
        }
        break;
      case 'file-data-update':
        sidebarState = { ...sidebarState, ...message.payload };
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
    return (
      sidebarState.stepType !== originalState.stepType ||
      sidebarState.stepMessage.trim() !== originalState.stepMessage.trim()
    );
  },

  validate() {},
} as const;
