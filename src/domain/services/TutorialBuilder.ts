import * as path from 'path';
import { Tutorial, TutorialData } from '../models/Tutorial';
import { GitService } from './GitService';
import { Domain } from '@gitorial/shared-types';
import { DomainCommit } from '../ports/IGitOperations';
import { Step } from '../models/Step';

export class TutorialBuilder {
  private static readonly VALID_STEP_TYPES: ReadonlyArray<Domain.Commit.Type> = Domain.Commit.Types;

  private static readonly REPO_URL_PATTERNS = [
    {
      platform: 'github',
      pattern: /github\.com[\/:]([^\/]+)\/([^\/\.]+)(\.git)?$/i,
    },
    {
      platform: 'gitlab',
      pattern: /gitlab\.com[\/:]([^\/]+)\/([^\/\.]+)(\.git)?$/i,
    },
  ];

  public static async buildFromLocalPath(repoPath: string, gitService: GitService): Promise<Tutorial | null> {
    const repoUrl = await gitService.getRepoUrl();
    if (!repoUrl) {
      throw new Error('For now a gitorial needs to be linked to a remote origin');
    }

    const details = this.extractRepoDetails(repoUrl);
    if (!details) {
      throw new Error('Could not get repo details out of remote url: ' + repoUrl);
    }

    const id = this.generateTutorialId(details.owner, details.repo);
    const title = path.basename(repoPath);

    const domainCommits = await gitService.getCommitHistory();
    if (domainCommits.length === 0) {
      console.log(`No commits found in repository: ${repoPath}`);
      return null;
    }

    const steps = this.extractStepsFromCommits(domainCommits, id);
    const tutorialData: TutorialData = {
      id,
      title,
      repoUrl,
      localPath: repoPath,
      steps,
      activeStepIndex: 0,
    };

    return new Tutorial(tutorialData);
  }

  /**
   * Generate a tutorial ID from a repository URL
   */
  public static generateTutorialId(owner: string, repo: string): Domain.TutorialId {
    const identifier = `${owner}/${repo}`;
    return identifier as Domain.TutorialId;
  }

  public static extractRepoDetails(repoUrl: string): {
    platform: string;
    owner: string;
    repo: string;
  } | null {
    for (const { platform, pattern } of this.REPO_URL_PATTERNS) {
      const match = repoUrl.match(pattern);
      if (match) {
        return {
          platform,
          owner: match[1],
          repo: match[2],
        };
      }
    }
    return null;
  }

  /**
   * Create a deep link URL for a tutorial step
   */
  public static createDeepLink(tutorial: Tutorial, stepIndex: number): string | null {
    if (!tutorial.repoUrl) {
      console.warn('Cannot create deep link: tutorial.repoUrl is undefined.');
      return null;
    }
    const repoDetails = this.extractRepoDetails(tutorial.repoUrl);
    if (!repoDetails) {
      return null;
    }

    const step = tutorial.steps[stepIndex];
    if (!step) {
      return null;
    }

    //FIX: This is currently a wrong deep link format
    return `gitorial://sync?platform=${repoDetails.platform}&owner=${repoDetails.owner}&repo=${repoDetails.repo}&commitHash=${step.commitHash}`;
  }

  /**
   * Converts raw commit data (from IGitOperations) into Step domain models.
   */
  public static extractStepsFromCommits(commits: DomainCommit[], tutorialId: Domain.TutorialId): Step[] {
    //TODO: use our new classes inside src/domain/models/ to parse steps
    const chronologicalCommits = [...commits].reverse();

    console.log(`🔍 TutorialBuilder: Processing ${chronologicalCommits.length} commits for tutorial ${tutorialId}`);

    return chronologicalCommits.map((commit, index) => {
      const message = commit.message.trim();
      console.log(`🔍 TutorialBuilder: Processing commit ${index + 1}: hash="${commit.hash}", message="${message}"`);
      const colonIndex = message.indexOf(':');

      if (colonIndex <= 0) {
        console.error(`🔍 TutorialBuilder: ERROR - Commit message "${message}" missing type prefix!`);
        throw new Error(`TutorialBuilder: Commit message "${message}" missing type prefix.`);
      }

      const parsedType = message.substring(0, colonIndex).toLowerCase();
      if (!this.VALID_STEP_TYPES.includes(parsedType as Domain.Commit.Type)) {
        throw new Error(`TutorialBuilder: Invalid step type "${parsedType}" in commit message: "${message}".`);
      }

      const stepType = parsedType as Domain.Commit.Type;
      const stepTitle = message.substring(colonIndex + 1).trim() || 'Unnamed Step';

      const stepData: Domain.StepData = {
        id: `${tutorialId}-step-${index + 1}-${commit.hash.substring(0, 7)}`,
        title: stepTitle,
        commitHash: commit.hash,
        type: stepType,
        index,
      };

      return new Step(stepData);
    });
  }
}
