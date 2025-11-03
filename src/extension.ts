import * as vscode from 'vscode';

// Infrastructure
import { createDiffDisplayerAdapter } from '@infra/adapters/DiffDisplayerAdapter';
import { createMementoAdapter } from '@infra/adapters/MementoAdapter';
import { createProgressReportAdapter } from '@infra/adapters/ProgressReportAdapter';
import { GitOperationsFactory } from '@infra/factories/GitOperationsFactory';
import { AutoOpenState } from '@infra/state/AutoOpenState';
import { createMarkdownConverterAdapter } from '@infra/adapters/MarkdownConverter';
import { StepContentRepository } from '@infra/repositories/StepContentRepository';
import { MementoActiveTutorialStateRepository } from '@infra/repositories/MementoActiveTutorialStateRepository';
import { GitChangesFactory } from '@infra/factories/GitChangesFactory';
import { GlobalState } from '@infra/state/GlobalState';
import { createUserInteractionAdapter } from '@infra/adapters/VSCodeUserInteractionAdapter';
import { createFileSystemAdapter } from '@infra/adapters/VSCodeFileSystemAdapter';
import { ContextState } from '@infra/state/ContextState';
import { ConfigurationState } from '@infra/state/ConfigurationState';
import { AuthorManifestState } from '@infra/state/AuthorManifestState';

// Domain
import { DiffService } from '@domain/services/DiffService';
import { TutorialRepositoryImpl } from '@domain/repositories/TutorialRepositoryImpl';
import { TutorialService } from '@domain/services/tutorial-service';
import { TutorialViewModelConverter } from '@domain/converters/TutorialViewModelConverter';
import { TutorialChangeDetector } from '@domain/utils/TutorialChangeDetector';
import { TutorialDisplayService } from '@domain/services/TutorialDisplayService';
import { Domain } from '@gitorial/shared-types';
// UI
import { TutorialSolutionWorkflow } from '@ui/tutorial/TutorialSolutionWorkflow';
import { TutorialUriHandler } from '@ui/deep-link/UriHandler';
import { TutorialController } from '@ui/tutorial/controller';
import { CommandHandler } from '@ui/tutorial/CommandHandler';
import { AuthorModeController } from '@ui/tutorial/authoring/controller';
import { EditorManager } from '@ui/tutorial/manager/EditorManager';
import { SystemController } from '@ui/system/SystemController';
import {
  IWebviewSystemMessageHandler,
  IWebviewTutorialMessageHandler,
  IWebviewAuthorMessageHandler,
  WebviewMessageHandler,
} from '@ui/webview/WebviewMessageHandler';
import { WebviewPanelManager } from '@ui/webview/WebviewPanelManager';
import { TutorialAuthoringService } from '@domain/services/authoring/TutorialAuthoringService';
import { AuthoringDraftRepository } from '@domain/repositories/AuthoringDraftRepository';
import { ChangesSidebarProvider } from '@ui/tutorial/tree-view/ChangesSidebarProvider';
import { StepsTreeDataProvider } from '@ui/tutorial/tree-view/StepsTreeProvider';
import { DiffCommandHandler } from '@ui/tutorial/tree-view/DiffCommandHandler';
import { StepTypeSelector } from '@ui/tutorial/tree-view/StepTypeSelector';
import { StepsCommandHandler } from '@ui/tutorial/tree-view/StepsCommandHandler';

/**

/**
 * Main extension activation point.
 * This function is called when the extension is activated.
 */
export async function activate(context: vscode.ExtensionContext): Promise<{
  context              : vscode.ExtensionContext;
  tutorialController   : TutorialController;
  autoOpenState        : AutoOpenState;
  authorModeController : AuthorModeController;
}> {
  console.log('📖 Gitorial extension active');

  const application = await bootstrapApplication(context);
  if (!application) {
    return Promise.reject();
  }

  const {
    tutorialController,
    autoOpenState,
    systemController,
    authorModeController,
    userInteractionAdapter,
    workspacePath,
    changesWebviewProvider,
    stepsTreeDataProvider,
    stepTypeSelector,
    workspaceGitOperations,
  } = application;

  const commandHandler = new CommandHandler(
    tutorialController,
    systemController,
    authorModeController,
    userInteractionAdapter,
    workspacePath
  );
  const uriHandler = new TutorialUriHandler(tutorialController);

  console.log('📖 Registering regular commands...');
  commandHandler.register(context);

  console.log('📖 Registering URI handler...');
  uriHandler.register(context);

  console.log('📖 Registering webview and tree view providers...');

  // Register the webview provider for Changes
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gitorial-changes-webview', changesWebviewProvider),
    changesWebviewProvider // Add the provider itself to dispose its file watcher
  );

  // Register commands for the Changes view
  context.subscriptions.push(
    vscode.commands.registerCommand('gitorial.resetAll', async () => {
      await changesWebviewProvider.resetAll();
    })
  );

  // Register steps command handler
  const stepsCommandHandler = new StepsCommandHandler(workspaceGitOperations, stepsTreeDataProvider, stepTypeSelector);
  stepsCommandHandler.register(context);

  // Register the tree view for Steps
  const stepsTreeView = vscode.window.createTreeView('gitorial-steps', {
    treeDataProvider : stepsTreeDataProvider,
    showCollapseAll  : true,
  });

  context.subscriptions.push(stepsTreeView, stepsTreeDataProvider);

  console.log('📖 Registering diff command handler...');
  DiffCommandHandler.register(context, workspaceGitOperations);

  await checkAndHandleAutoOpenState(tutorialController, autoOpenState);

  console.log('📖 Gitorial activation complete.');

  return {
    context,
    tutorialController,
    autoOpenState,
    authorModeController,
  };
}

/**
 * This function is called when the extension is deactivated.
 * It can be used to clean up any resources.
 */
export function deactivate() {
  console.log('📖 Gitorial extension deactivated');
  // Clean up the active controller if it exists
}

async function bootstrapApplication(context: vscode.ExtensionContext) {
  // --- Adapters ---
  const globalStateMementoAdapter = createMementoAdapter(context, false);
  const workspaceStateMementoAdapter = createMementoAdapter(context, true);
  const userInteractionAdapter = createUserInteractionAdapter();
  const fileSystemAdapter = createFileSystemAdapter();
  const progressReportAdapter = createProgressReportAdapter();
  const markdownConverter = createMarkdownConverterAdapter();
  const diffDisplayerAdapter = createDiffDisplayerAdapter();

  // --- State ---
  const globalState = new GlobalState(globalStateMementoAdapter);
  const autoOpenState = new AutoOpenState(globalState);
  const contextState = new ContextState(context);
  const configurationState = new ConfigurationState(context);
  const _authorManifestBackupState = new AuthorManifestState(globalState);

  // --- Factories ---
  //? TODO: Why do we need factories? Why dont we just create instances of them and pass around?
  const gitOperationsFactory = new GitOperationsFactory();
  const gitChangesFactory = new GitChangesFactory();

  // --- Determine Workspace ID ---
  let workspacePath: string | undefined;
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
  } else {
    userInteractionAdapter.showWarningMessage('No workspace folder open. \nExiting Gitorial extension');
    return;
  }

  // --- Infrastructure Repositories ---
  const stepContentRepository = new StepContentRepository(fileSystemAdapter);
  const activeTutorialStateRepository = new MementoActiveTutorialStateRepository(workspaceStateMementoAdapter);
  const tutorialRepository = new TutorialRepositoryImpl(
    workspaceStateMementoAdapter, // Using workspace specific state for tutorials
    gitOperationsFactory.fromPath
  );

  // --- Domain Services ---
  const tutorialService = new TutorialService(
    tutorialRepository,
    gitOperationsFactory,
    stepContentRepository,
    activeTutorialStateRepository,
    workspacePath
  );

  const diffService = new DiffService(diffDisplayerAdapter, fileSystemAdapter, gitChangesFactory, workspacePath);
  const tutorialViewModelConverter = new TutorialViewModelConverter(markdownConverter);
  const tutorialDisplayService = new TutorialDisplayService(tutorialViewModelConverter, diffService);

  // --- UI Services ---

  const editorManager = new EditorManager(fileSystemAdapter);

  const changeDetector = new TutorialChangeDetector();
  const solutionWorkflow = new TutorialSolutionWorkflow(diffService, editorManager);

  // Add services to context subscriptions for proper disposal
  context.subscriptions.push(solutionWorkflow);

  // Create a placeholder webview panel manager first
  let webviewPanelManager: WebviewPanelManager;

  // Create webview panel manager first
  webviewPanelManager = new WebviewPanelManager(context.extensionUri, () => {
    // Placeholder message handler - will be updated after controllers are created
    console.warn('WebviewPanelManager: Message received before controllers are ready');
  });

  // Create a temporary message handler that will be replaced later
  const tempMessageHandler = new WebviewMessageHandler(
    {
      handleWebviewMessage : async () => {
        console.warn('Tutorial message handler not ready yet');
      },
    },
    {
      handleWebviewMessage : async () => {
        console.warn('System message handler not ready yet');
      },
    },
    {
      handleWebviewMessage : async () => {
        console.warn('Author message handler not ready yet');
      },
    }
  );

  // Set the temporary message handler immediately
  webviewPanelManager.updateMessageHandler(tempMessageHandler.handleMessage.bind(tempMessageHandler));

  // Create controllers first
  const systemController = await SystemController.new(
    contextState,
    configurationState,
    webviewPanelManager,
    userInteractionAdapter
  );

  const tutorialController = new TutorialController(
    progressReportAdapter,
    userInteractionAdapter,
    fileSystemAdapter,
    tutorialService,
    autoOpenState,
    tutorialDisplayService,
    solutionWorkflow,
    changeDetector,
    gitChangesFactory,
    markdownConverter,
    webviewPanelManager
  );

  const draftStorage = createMementoAdapter(context, true);
  const authoringDraftRepository = new AuthoringDraftRepository(draftStorage);
  const authoringService = new TutorialAuthoringService(
    gitOperationsFactory,
    diffService,
    { v1: Domain.CommitList.V1.Rules },
    authoringDraftRepository
  );

  const authorModeController = new AuthorModeController(
    systemController,
    gitOperationsFactory,
    activeTutorialStateRepository,
    workspacePath,
    tutorialController,
    authoringService
  );

  // Set the tutorial controller reference in system controller
  systemController.setTutorialController(tutorialController);

  // Now create the message handlers after all controllers are created
  const tutorialMessageHandler: IWebviewTutorialMessageHandler = {
    handleWebviewMessage : msg => tutorialController.handleWebviewMessage(msg),
  };
  const systemMessageHandler: IWebviewSystemMessageHandler = {
    handleWebviewMessage : msg => systemController.handleWebviewMessage(msg),
  };
  const authorMessageHandler: IWebviewAuthorMessageHandler = {
    handleWebviewMessage : msg => authorModeController.handleWebviewMessage(msg),
  };

  const webviewMessageHandler = new WebviewMessageHandler(tutorialMessageHandler, systemMessageHandler, authorMessageHandler);

  // Update the webview panel manager with the real message handler
  webviewPanelManager.updateMessageHandler(webviewMessageHandler.handleMessage.bind(webviewMessageHandler));

  // --- Webview and Tree Data Providers ---
  const workspaceGitOperations = gitOperationsFactory.fromPath(workspacePath);
  const stepTypeSelector = new StepTypeSelector(workspaceGitOperations);
  const changesWebviewProvider = new ChangesSidebarProvider(
    workspaceGitOperations,
    stepTypeSelector,
    workspacePath,
    context.extensionUri
  );
  const stepsTreeDataProvider = new StepsTreeDataProvider(gitOperationsFactory, workspacePath);

  return {
    tutorialController,
    autoOpenState,
    systemController,
    gitOperationsFactory,
    fileSystemAdapter,
    userInteractionAdapter,
    authorModeController,
    workspacePath,
    changesWebviewProvider,
    stepsTreeDataProvider,
    stepTypeSelector,
    workspaceGitOperations,
  } as const;
}

/**
 * Checks if there's a pending auto-open state and automatically opens the tutorial.
 * This is called during extension activation to handle tutorial opening after workspace switches.
 */
async function checkAndHandleAutoOpenState(tutorialController: TutorialController, autoOpenState: AutoOpenState): Promise<void> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const pending = autoOpenState.get();
    if (!pending) {
      return;
    }

    const ageMs =
      Date.now() -
      new Date(pending.timestamp)
        .getTime();
    if (ageMs > 10_000) {
      console.log('Gitorial: Auto-open state expired, clearing it');
      autoOpenState.clear();
      return;
    }

    console.log('Gitorial: Found pending auto-open state, attempting to open tutorial automatically');

    await tutorialController.openFromWorkspace({
      commitHash : pending.commitHash,
      force      : true,
    });
  } catch (error) {
    console.error('Gitorial: Error during auto-open check:', error);
    autoOpenState.clear();
  }
}
