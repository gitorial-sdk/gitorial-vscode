import { Domain } from '@gitorial/shared-types';
import { Result } from 'neverthrow';

export type ManifestBackupServiceError =
  | { type: 'corrupted_hash' }
  | { type: 'failed_retrieving' }
  | { type: 'saniziation_failed' };

export interface IManifestBackupService {
  save(repoPath: string, manifest: Domain.AuthorManifestData): Promise<Result<void, ManifestBackupServiceError>>;
  get(repoPath: string): Promise<Result<Domain.AuthorManifestData, ManifestBackupServiceError>>;
  clear(repoPath: string): Promise<void>;
}
