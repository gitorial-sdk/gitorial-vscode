import { Domain } from '@gitorial/shared-types';
import { Result } from 'neverthrow';

type TCommit = Domain.Commit.Base;

export type RepositoryError = { operation: 'read' | 'write'; message: string };

/**
 * Our Data-Transfer-Object. Keep it inside the boundries of our AuthoringDraftRepository
 */
export type AuthoringDraftData = {
  data : TCommit[];
  meta : {
    version   : 'v1'; // Currently we only have v1
    timestamp : number;
  };
};

export interface IAuthoringDraftRepository {
  get(): AuthoringDraftData | undefined;
  save(commits: TCommit[], version: 'v1'): Promise<Result<void, RepositoryError>>;
  clear(): Promise<Result<void, RepositoryError>>;
}
