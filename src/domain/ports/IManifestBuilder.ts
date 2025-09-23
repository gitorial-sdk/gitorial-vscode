import { Domain } from '@gitorial/shared-types';
import { Result } from 'neverthrow';

export type ManifestBuilderError =
  | { type: 'no_gitorial_branch' }
  | { type: 'unknown'; msg: string }
  | { type: 'validation_rule'; msg: unknown };

export interface IManifestBuilder {
  create(workspacePath: string): Promise<Result<Domain.AuthorManifestData, ManifestBuilderError>>;
}
