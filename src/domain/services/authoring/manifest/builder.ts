import { IGitOperationsFactory } from '@domain/ports/IGitOperationsFactory';
import { DiffService } from '@domain/services/DiffService';
import { Domain } from '@gitorial/shared-types';
import { IGitChanges } from '@ui/ports/IGitChanges';
import { IManifestBuilderService, ManifestBuilderServiceError } from '@ui/ports/IManifestBuilderService';
import { err, ok, Result } from 'neverthrow';

export class ManifestBuilderService implements IManifestBuilderService {
  constructor(
    private readonly gitFactory: IGitOperationsFactory, //TODO refactor to "No factory"
    private readonly gitChanges: IGitChanges,
    private readonly diffService: DiffService
  ) {}

  public async create(workspacePath: string): Promise<Result<Domain.AuthorManifestData, ManifestBuilderServiceError>> {
    try {
      const git = this.gitFactory.fromPath(workspacePath);
      const info = await git.getRepoInfo();

      if (!info.branches.all.includes('gitorial')) {
        return err({ type: 'no_gitorial_branch' });
      }

      const commits = await git.getCommits('gitorial');

      const steps: Domain.ManifestStep[] = [];
      for (const c of commits) {
        const diffModelsResult = await this.diffService.getFiles(c.hash, 'manifest');
        if (diffModelsResult.isErr()) {
          return err({ type: 'unknown', msg: String(diffModelsResult.error) });
        }

        const { changedFiles, learningMarkerFiles } = diffModelsResult.value;

        const diffModelFilePaths = changedFiles.map(m => m.relativePath);
        const toDoComments: Domain.Commit.ToDoComment[] = learningMarkerFiles.map(m => {
          return { realtiveFilePath: m.relativePath };
        });

        const result = Domain.Commit.V1.Validator.buildCommitFromMessage(c.message, c.hash, diffModelFilePaths, toDoComments);

        if (result.isErr()) {
          return err({ type: 'validation_rule', msg: result._unsafeUnwrapErr() });
        }
        const commit = result._unsafeUnwrap();
        steps.push({ commit: commit.hash, type: commit.type, title: commit.title });
      }

      const manifest = {
        authoringBranch : info.branches.current || 'main',
        publishBranch   : 'gitorial',
        steps           : steps.slice()
          .reverse(),
      };

      return ok(manifest);
    } catch (e) {
      return err({ type: 'unknown', msg: 'ManifestBuilderService Failed: ' + e });
    }
  }
}
