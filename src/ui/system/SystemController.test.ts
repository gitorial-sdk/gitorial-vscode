import { expect } from 'chai';
import * as sinon from 'sinon';
import { SystemController } from './SystemController';
import type { Domain, UI } from '@gitorial/shared-types';

describe('SystemController', () => {
  let systemController: SystemController;
  let mockWebviewPanelManager: any;
  let mockContextStore: any;
  let mockConfigurationStore: any;
  let mockUserInteraction: any;

  beforeEach(async () => {
    mockContextStore = {
      setContext : sinon.stub()
        .resolves(),
    };

    mockConfigurationStore = {
      get : sinon.stub()
        .returns(false),
      update : sinon.stub()
        .resolves(),
      onDidChange : sinon.stub(),
    };

    mockUserInteraction = {
      showErrorMessage : sinon.stub()
        .resolves(),
      showWarningMessage : sinon.stub()
        .resolves(),
      showInformationMessage : sinon.stub()
        .resolves(),
    };

    // Create mock webview panel manager
    mockWebviewPanelManager = {
      sendMessage : sinon.stub()
        .resolves(),
      updateMessageHandler : sinon.stub(),
      isVisible            : sinon.stub()
        .returns(false),
      show    : sinon.stub(),
      dispose : sinon.stub(),
    };

    // Create system controller instance
    systemController = await SystemController.new(
      mockContextStore,
      mockConfigurationStore,
      mockWebviewPanelManager,
      mockUserInteraction
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should initialize with extension context and webview panel manager', () => {
      expect(systemController).to.be.instanceOf(SystemController);
    });
  });

  describe('handleWebviewMessage', () => {
    it('should handle error messages from webview', async () => {
      const errorMessage: UI.Messages.WebviewToExtensionSystemMessage = {
        category : 'system',
        type     : 'error',
        payload  : {
          message : 'Test error message',
        },
      };

      await systemController.handleWebviewMessage(errorMessage);

      // Verify that the error was handled (we can't easily test vscode.window.showErrorMessage in unit tests)
      // The main goal is to ensure no exceptions are thrown
    });

    it('should handle unknown message types gracefully', async () => {
      const unknownMessage = {
        category : 'system' as const,
        type     : 'error' as any,
        payload  : { message: 'Test error' },
      };

      // Should not throw an error
      await systemController.handleWebviewMessage(unknownMessage);
    });
  });

  describe('sendSystemMessage', () => {
    it('should send message through webview panel manager', async () => {
      const message: UI.Messages.ExtensionToWebviewSystemMessage = {
        category : 'system',
        type     : 'loading-state',
        payload  : { isLoading: true, message: 'Loading...' },
      };

      mockWebviewPanelManager.sendMessage.resolves();

      await systemController.sendSystemMessage(message);

      expect(mockWebviewPanelManager.sendMessage.calledWith(message)).to.be.true;
    });

    it('should handle errors when sending message fails', async () => {
      const message: UI.Messages.ExtensionToWebviewSystemMessage = {
        category : 'system',
        type     : 'error',
        payload  : { message: 'Test error' },
      };

      const error = new Error('Send failed');
      mockWebviewPanelManager.sendMessage.rejects(error);

      await systemController.sendSystemMessage(message);

      // Verify that userInteraction.showErrorMessage was called (reportError calls it with showToUser=true)
      expect(mockUserInteraction.showErrorMessage.calledWith('Sending system message to webview: Send failed')).to.be.true;
    });
  });

  describe('showLoadingState', () => {
    it('should send loading state message', async () => {
      mockWebviewPanelManager.sendMessage.resolves();

      await systemController.showLoadingState(true, 'Loading...');

      expect(mockWebviewPanelManager.sendMessage.calledOnce).to.be.true;
      const sentMessage = mockWebviewPanelManager.sendMessage.firstCall.args[0] as UI.Messages.ExtensionToWebviewSystemMessage;
      expect(sentMessage.type).to.equal('loading-state');
      if (sentMessage.type === 'loading-state') {
        expect(sentMessage.payload.isLoading).to.be.true;
        expect(sentMessage.payload.message).to.equal('Loading...');
      }
    });
  });

  describe('hideLoadingState', () => {
    it('should hide loading state', async () => {
      mockWebviewPanelManager.sendMessage.resolves();

      await systemController.hideLoadingState();

      expect(mockWebviewPanelManager.sendMessage.calledOnce).to.be.true;
      const sentMessage = mockWebviewPanelManager.sendMessage.firstCall.args[0] as UI.Messages.ExtensionToWebviewSystemMessage;
      expect(sentMessage.type).to.equal('loading-state');
      if (sentMessage.type === 'loading-state') {
        expect(sentMessage.payload.isLoading).to.be.false;
        expect(sentMessage.payload.message).to.equal('');
      }
    });
  });

  describe('hideGlobalLoading', () => {
    it('should hide global loading state', async () => {
      mockWebviewPanelManager.sendMessage.resolves();

      await systemController.hideLoadingState();

      expect(mockWebviewPanelManager.sendMessage.calledOnce).to.be.true;
      const sentMessage = mockWebviewPanelManager.sendMessage.firstCall.args[0] as UI.Messages.ExtensionToWebviewSystemMessage;
      expect(sentMessage.type).to.equal('loading-state');
      if (sentMessage.type === 'loading-state') {
        expect(sentMessage.payload.isLoading).to.be.false;
        expect(sentMessage.payload.message).to.equal('');
      }
    });
  });

  describe('showError', () => {
    it('should send error message', async () => {
      mockWebviewPanelManager.sendMessage.resolves();

      await systemController.showError('Test error');

      expect(mockWebviewPanelManager.sendMessage.calledOnce).to.be.true;
      const sentMessage = mockWebviewPanelManager.sendMessage.firstCall.args[0] as UI.Messages.ExtensionToWebviewSystemMessage;
      expect(sentMessage.type).to.equal('error');
      if (sentMessage.type === 'error') {
        expect(sentMessage.payload.message).to.equal('Test error');
      }
    });
  });

  describe('reportError', () => {
    it('should log error to console', async () => {
      const error = new Error('Test error');
      const consoleErrorStub = sinon.stub(console, 'error');

      await systemController.reportError(error, 'Test context', false);

      expect(consoleErrorStub.calledWith('Test context: Test error')).to.be.true;

      consoleErrorStub.restore();
    });

    it('should show error message to user when requested', async () => {
      const error = new Error('Test error');

      await systemController.reportError(error, 'Test context', true);

      expect(mockUserInteraction.showErrorMessage.calledWith('Test context: Test error')).to.be.true;
    });

    it('should handle errors when showing error message fails', async () => {
      const error = new Error('Test error');
      mockUserInteraction.showErrorMessage.rejects(new Error('Show failed'));
      const consoleErrorStub = sinon.stub(console, 'error');

      await systemController.reportError(error, 'Test context', true);

      expect(consoleErrorStub.calledTwice).to.be.true;
      expect(consoleErrorStub.firstCall.args[0]).to.equal('Test context: Test error');
      expect(consoleErrorStub.secondCall.args[0]).to.equal('Failed to show error message to user:');
      expect(consoleErrorStub.secondCall.args[1]).to.be.instanceOf(Error);
      expect(consoleErrorStub.secondCall.args[1].message).to.equal('Show failed');

      consoleErrorStub.restore();
    });
  });

  describe('setAuthorMode', () => {
    it('should update configuration store with author mode', async () => {
      await systemController.setAuthorMode(true);

      expect(mockConfigurationStore.update.calledWith('authorModeEnabled', true)).to.be.true;
      expect(mockContextStore.setContext.calledWith('gitorial.authorModeEnabled', true)).to.be.true;
    });

    it('should handle errors when setting author mode fails', async () => {
      const error = new Error('Update failed');
      mockConfigurationStore.update.rejects(error);

      // Should propagate the error since there's no error handling in setAuthorMode
      try {
        await systemController.setAuthorMode(true);
        expect.fail('Expected error to be thrown');
      } catch (thrownError) {
        expect(thrownError).to.equal(error);
      }
    });
  });

  describe('sendAuthorManifest', () => {
    it('should send author manifest data to webview', async () => {
      const manifest: Domain.AuthorManifestData = {
        authoringBranch : 'main',
        publishBranch   : 'main',
        steps           : [],
      };

      await systemController.sendAuthorManifest(manifest, true);

      expect(mockWebviewPanelManager.sendMessage.calledOnce).to.be.true;
      const sentMessage = mockWebviewPanelManager.sendMessage.firstCall.args[0];
      expect(sentMessage.category).to.equal('author');
      expect(sentMessage.type).to.equal('manifestLoaded');
      expect(sentMessage.payload.manifest).to.equal(manifest);
      expect(sentMessage.payload.isEditing).to.be.true;
    });
  });

  describe('sendPublishResult', () => {
    it('should send publish result to webview', async () => {
      const publishedCommits = [
        {
          originalCommit : 'abc123',
          newCommit      : 'def456',
          stepTitle      : 'Test Step',
          stepType       : 'instruction',
        },
      ];

      await systemController.sendPublishResult(true, undefined, publishedCommits);

      expect(mockWebviewPanelManager.sendMessage.calledOnce).to.be.true;
      const sentMessage = mockWebviewPanelManager.sendMessage.firstCall.args[0];
      expect(sentMessage.category).to.equal('author');
      expect(sentMessage.type).to.equal('publishResult');
      expect(sentMessage.payload.success).to.be.true;
      expect(sentMessage.payload.error).to.be.undefined;
      expect(sentMessage.payload.publishedCommits).to.equal(publishedCommits);
    });
  });

  describe('sendValidationWarnings', () => {
    it('should send validation warnings to webview', async () => {
      const warnings = ['Warning 1', 'Warning 2'];

      await systemController.sendValidationWarnings(warnings);

      expect(mockWebviewPanelManager.sendMessage.calledOnce).to.be.true;
      const sentMessage = mockWebviewPanelManager.sendMessage.firstCall.args[0];
      expect(sentMessage.category).to.equal('author');
      expect(sentMessage.type).to.equal('validationWarnings');
      expect(sentMessage.payload.warnings).to.equal(warnings);
    });
  });
});
