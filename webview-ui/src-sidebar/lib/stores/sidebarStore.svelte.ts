import type { UI, Domain } from '@gitorial/shared-types';
import { sendMessage } from '../utils/messaging';

interface SidebarState {
  stepType         : Domain.Commit.Type;
  stepMessage      : string;
  stagedFiles      : Array<{ path: string; status: string }>;
  unstagedFiles    : Array<{ path: string; status: string }>;
  stagedCollapsed  : boolean;
  changesCollapsed : boolean;
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

export const sidebarStore = {
  get stepType() {
    return sidebarState.stepType;
  },
  get stepMessage() {
    return sidebarState.stepMessage;
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
    console.log('SidebarStore: Received message:', message);
    switch (message.type) {
      case 'data-update':
        //TODO: rename the variables to make it easier to identify them across the app
        // furthermore we can than move on to just descruct
        // sidebarState = {sidebarState, ...message.payload};
        sidebarState.stagedFiles = message.payload.staged;
        sidebarState.unstagedFiles = message.payload.changes;
        sidebarState.stepType = message.payload.currentStepType;
        sidebarState.stepMessage = message.payload.currentStepMessage;

        break;
    }
  },

  validate() {
    if (!sidebarStore.stepMessage.trim()) {
      sendMessage({
        type    : 'showError',
        payload : { message: 'Commit message cannot be empty' },
      });
      return;
    }

    sendMessage({
      type    : 'validate',
      payload : { stepType: this.stepType, message: this.stepMessage.trim() },
    });
  },
} as const;
