import { GitStateCommit, GitStateData } from './types';
import { StateTransitionHandler } from './stf';

export const gitState: GitStateData = {
  hasConflict      : false,
  isRebasing       : false,
  gitorialHeadHash : null,
  commit           : null,
  files            : {
    staged   : [],
    unstaged : [],
    merge    : [],
  },
};

export class GitState {
  private _state: GitStateData;

  constructor(private readonly transitionHandler: StateTransitionHandler) {
    this._state = gitState;
  }

  public mutate(partialState: Partial<GitStateData>): void {
    const newState = this.transitionHandler.transition(this._state, partialState);
    this._state = newState;
  }

  /**
   * Gets a copy of the current state
   */
  public get getStateSnapshot(): GitStateData {
    return { ...this._state } satisfies GitStateData;
  }

}
