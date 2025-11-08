import { Domain, UI } from '@gitorial/shared-types';

export type GitStateCommit = {
  hash    : string;
  type    : Domain.Commit.Type;
  message : string;
};

export type GitStateData = {
  hasConflict : boolean;
  isRebasing  : boolean;
  files       : {
    staged   : UI.Messages.SourceCodeFile[];
    unstaged : UI.Messages.SourceCodeFile[];
    merge    : UI.Messages.SourceCodeFile[];
  };
} & (
  | {
      gitorialHeadHash : string;
      commit           : GitStateCommit;
    }
  | {
      gitorialHeadHash? : null;
      commit?           : null;
    }
);

export type Hooks = {
  onRebaseStart?    : () => void;
  onRebaseConflict? : (data: {
    stepType    : Domain.Commit.Type;
    stepMessage : string;
    mergeFiles  : UI.Messages.SourceCodeFile[];
  }) => void;
  onRebaseSuccess?    : () => void;
  onSourceFileChange? : (fileData: {
    stagedFiles   : UI.Messages.SourceCodeFile[];
    unstagedFiles : UI.Messages.SourceCodeFile[];
    mergeFiles    : UI.Messages.SourceCodeFile[];
  }) => void;
  onRebaseAbort? : () => void;
};
