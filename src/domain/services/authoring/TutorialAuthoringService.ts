/*
Tutorial Authoring Service - Domain Layer

Core business logic for tutorial authoring operations:
- Loading/creating commit lists from various sources
- Validating commit sequences using business rules
- Managing draft vs validated commit lists
- Converting between different representations
*/

import { Result, err, ok } from 'neverthrow';
import { CommitList } from '@domain/models/CommitList';
import { DraftCommitList } from '@domain/models/DraftCommitList';
import { Commit } from '@domain/models/Commit';
import { Domain } from '@gitorial/shared-types';
import { IGitOperationsFactory } from '@domain/ports/IGitOperationsFactory';
import { DiffService } from '@domain/services/DiffService';
import { AuthoringDraftData, IAuthoringDraftRepository } from '@domain/ports/IAuthoringDraftRepository';

// Error types for this service
export type AuthoringServiceError =
  | { type: 'repository_not_found'; path: string }
  | { type: 'no_gitorial_branch'; path: string }
  | { type: 'unsupported_version'; version: string; message: string }
  | { type: 'git_operation_failed'; message: string }
  | { type: 'validation_failed'; errors: Array<Domain.CommitList.Validation.Error<string>> }
  | { type: 'commit_parsing_failed'; commitHash: string; message: string }
  | { type: 'storage_operation_failed'; message: string };

type AuthoringErrorCode = keyof typeof Domain.CommitList.V1.Errors;

type TCommitListRule<T extends string> = Domain.CommitList.Validation.Rule<T>;

export class TutorialAuthoringService {
  constructor(
    private readonly gitOperationsFactory: IGitOperationsFactory,
    private readonly diffService: DiffService,
    private readonly commitListRules: { v1: ReadonlyArray<TCommitListRule<AuthoringErrorCode>> },
    private readonly draftRepository: IAuthoringDraftRepository
  ) {}

  /**
   * Prioritizes loading a draft commit list from storage; if unavailable, attempts to fetch from git history.
   * If neither is found, creates an empty draft for editing.
   * Always returns a mutable DraftCommitList that can be edited before validation.
   */
  public async loadDraftCommitList(
    workspacePath: string
  ): Promise<Result<{ location: 'storage' | 'git' | 'new'; list: DraftCommitList<AuthoringErrorCode> }, AuthoringServiceError>> {
    const dto = this.draftRepository.get();
    if (dto) {
      const draftRes = this._buildDraftList(dto);
      if (draftRes.isErr()) {
        return err(draftRes.error);
      }
      return ok({ location: 'storage', list: draftRes.value });
    }

    const gitResult = await this._buildDraftFromGitHistory(workspacePath);
    if (gitResult.isOk()) {
      return ok({ location: 'git', list: gitResult.value });
    }

    const error = gitResult.error;
    if (error.type === 'no_gitorial_branch') {
      return ok({ location: 'new', list: DraftCommitList.beginEmpty<AuthoringErrorCode>(this.commitListRules.v1) });
    } else {
      return err(error);
    }
  }

  /**
   * Load a validated commit list from git history.
   * Returns an immutable CommitList that has passed all validation rules.
   */
  public async loadValidatedCommitList(
    workspacePath: string
  ): Promise<Result<CommitList<AuthoringErrorCode>, AuthoringServiceError>> {
    const git = this.gitOperationsFactory.fromPath(workspacePath);

    // Check if gitorial branch exists
    const branchExists = await git.branchExists('gitorial');
    if (!branchExists) {
      return err({ type: 'no_gitorial_branch', path: workspacePath });
    }

    try {
      const commits = await git.getCommits('gitorial');
      const domainCommits = await this._buildDomainCommits(commits, workspacePath);

      if (domainCommits.isErr()) {
        return err(domainCommits.error);
      }

      const commitList = CommitList.new(domainCommits.value, this.commitListRules.v1);
      if (commitList.isErr()) {
        return err({
          type   : 'validation_failed',
          errors : [commitList.error],
        });
      }

      return ok(commitList.value);
    } catch (error) {
      return err({
        type    : 'git_operation_failed',
        message : error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save a draft commit list to storage without validation.
   * Used for incremental saves during editing.
   */
  public async saveDraftCommitList(commits: Domain.Commit.Base[]): Promise<Result<void, AuthoringServiceError>> {
    const saveResult = await this.draftRepository.save(commits, 'v1');
    return saveResult.mapErr(error => ({
      type    : 'storage_operation_failed' as const,
      message : String(error),
    }));
  }

  /**
   * Finalize a draft into a validated commit list.
   * Applies all business rules and validation.
   */
  public async finalizeDraft(
    draft: DraftCommitList<AuthoringErrorCode>
  ): Promise<Result<CommitList<AuthoringErrorCode>, AuthoringServiceError>> {
    const finalizeResult = draft.finalize();

    if (finalizeResult.isErr()) {
      // Convert domain error to service error format
      const domainError = finalizeResult.error;
      const serviceError: Domain.CommitList.Validation.Error<string> = {
        index   : 'index' in domainError ? domainError.index : -1,
        code    : String(domainError.code),
        message : domainError.message,
      };

      return err({
        type   : 'validation_failed',
        errors : [serviceError],
      });
    }

    return ok(finalizeResult.value);
  }

  /**
   * Save a validated commit list to persistent storage.
   */
  public async saveCommitList(commitList: CommitList<AuthoringErrorCode>): Promise<Result<void, AuthoringServiceError>> {
    const commits = commitList
      .toArray()
      .map(c => c.data);
    const saveResult = await this.draftRepository.save(commits, 'v1');
    return saveResult.mapErr(error => ({
      type    : 'storage_operation_failed' as const,
      message : String(error),
    }));
  }

  /**
   * Create a new empty draft for starting fresh tutorial authoring.
   */
  public createEmptyDraft(): DraftCommitList<AuthoringErrorCode> {
    return DraftCommitList.beginEmpty<AuthoringErrorCode>(this.commitListRules.v1);
  }

  /**
   * Convert a validated commit list back to a draft for editing.
   */
  public commitListToDraft(commitList: CommitList<AuthoringErrorCode>): DraftCommitList<AuthoringErrorCode> {
    return commitList.toDraft();
  }

  /**
   * Build a draft commit list from git history.
   * Private method used internally.
   */
  private async _buildDraftFromGitHistory(
    workspacePath: string
  ): Promise<Result<DraftCommitList<AuthoringErrorCode>, AuthoringServiceError>> {
    const validatedResult = await this.loadValidatedCommitList(workspacePath);

    if (validatedResult.isErr()) {
      return err(validatedResult.error);
    }

    return ok(this.commitListToDraft(validatedResult.value));
  }

  /**
   * Convert raw git commits to domain Commit objects.
   * Enriches with file changes and TODO comments.
   */
  private async _buildDomainCommits(
    gitCommits: Array<{ hash: string; message: string }>,
    _workspacePath: string
  ): Promise<Result<Array<Commit>, AuthoringServiceError>> {
    const domainCommits: Array<Commit> = [];

    for (const gitCommit of gitCommits) {
      try {
        // Get file changes for this commit using DiffService
        const diffResult = await this.diffService.getFiles(gitCommit.hash, 'manifest');

        if (diffResult.isErr()) {
          return err({
            type       : 'commit_parsing_failed',
            commitHash : gitCommit.hash,
            message    : String(diffResult.error),
          });
        }

        const { changedFiles, learningMarkerFiles } = diffResult.value;
        const filePaths = changedFiles.map(f => f.relativePath);
        const toDoComments = learningMarkerFiles.map(f => ({
          realtiveFilePath : f.relativePath,
        }));

        // Build domain commit using existing validation
        const commitResult = Commit.new(gitCommit.message, gitCommit.hash, filePaths, toDoComments);

        if (commitResult.isErr()) {
          return err({
            type       : 'commit_parsing_failed',
            commitHash : gitCommit.hash,
            message    : commitResult.error.message,
          });
        }

        domainCommits.push(commitResult.value);
      } catch (error) {
        return err({
          type       : 'commit_parsing_failed',
          commitHash : gitCommit.hash,
          message    : error instanceof Error ? error.message : String(error),
        });
      }
    }

    return ok(domainCommits);
  }

  private _buildDraftList(
    repositoryData: AuthoringDraftData
  ): Result<DraftCommitList<AuthoringErrorCode>, AuthoringServiceError> {
    const rulesRes = this._selectRulesForVersion(repositoryData.meta.version);
    if (rulesRes.isErr()) {
      return err(rulesRes.error);
    }
    const draft = DraftCommitList.beginFrom<AuthoringErrorCode>(repositoryData.data, rulesRes.value);
    return ok(draft);
  }

  private _selectRulesForVersion(
    version: string
  ): Result<ReadonlyArray<TCommitListRule<AuthoringErrorCode>>, AuthoringServiceError> {
    switch (version) {
      case 'v1':
        return ok(this.commitListRules.v1);
      default:
        return err({
          type    : 'unsupported_version',
          version,
          message : `Unsupported version: ${version}`,
        });
    }
  }
}
