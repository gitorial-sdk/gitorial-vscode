import { Domain } from '@gitorial/shared-types';
import { Result } from 'neverthrow';

export type ManifestRepositoryError = { type: 'corrupted_hash' } | { type: 'failed_retrieving' } | { type: 'saniziation_failed' };

export interface IManifestRepository {
  save(repoPath: string, manifest: Domain.AuthorManifestData): Promise<Result<void, ManifestRepositoryError>>;
  get(repoPath: string): Promise<Result<Domain.AuthorManifestData, ManifestRepositoryError>>;
  clear(repoPath: string): Promise<void>;
}
