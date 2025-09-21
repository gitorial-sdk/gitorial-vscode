import { Domain } from '@gitorial/shared-types';
import { Result } from 'neverthrow';

export type ManifestBuilderServiceError =
  | { type: 'no_gitorial_branch' }
  | { type: 'unknown'; msg: string }
  | { type: 'validation_rule'; msg: unknown };

export interface IManifestBuilderService {
  create(workspacePath: string): Promise<Result<Domain.AuthorManifestData, ManifestBuilderServiceError>>;
}
