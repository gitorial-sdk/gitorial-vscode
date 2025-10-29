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
    switch (message.type) {
      case 'data-update':
        sidebarState = { ...sidebarState, ...message.payload };
        break;
      default:
        console.warn('Unknown message received: ', message);
    }
  },

  validate() {},
} as const;
