import { AuthoringDraftData, IAuthoringDraftRepository, RepositoryError } from '@domain/ports/IAuthoringDraftRepository';
import { IStateStorage } from '@domain/ports/IStateStorage';
import { Domain } from '@gitorial/shared-types';
import { err, ok, Result } from 'neverthrow';

type TCommit = Domain.Commit.Base;

export class AuthoringDraftRepository implements IAuthoringDraftRepository {
  private readonly AUTHORING_DRAFT_KEY = 'gitorial:authoring_draft';

  constructor(private readonly storage: IStateStorage) {}

  get(): AuthoringDraftData | undefined {
    return this.storage.get<AuthoringDraftData>(this.AUTHORING_DRAFT_KEY);
  }

  async save(commits: TCommit[], version: 'v1'): Promise<Result<void, RepositoryError>> {
    try {
      const dto: AuthoringDraftData = { data: commits, meta: { version: version, timestamp: Date.now() } };
      await this.storage.update(this.AUTHORING_DRAFT_KEY, dto);
    } catch (error) {
      return err({ operation: 'write', message: String(error) });
    }
    return ok(void 0);
  }

  async clear(): Promise<Result<void, RepositoryError>> {
    try {
      await this.storage.clear(this.AUTHORING_DRAFT_KEY);
    } catch (error) {
      return err({ operation: 'write', message: String(error) });
    }
    return ok(void 0);
  }
}
