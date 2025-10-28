<script lang="ts">
  import { vscode } from '../../src/lib/vscode';

  // State
  let stepType = $state('solution');
  let commitMessage = $state('');
  let stagedFiles = $state<Array<{ path: string; status: string }>>([]);
  let unstagedFiles = $state<Array<{ path: string; status: string }>>([]);
  let stagedCollapsed = $state(false);
  let changesCollapsed = $state(false);

  // Available step types
  const stepTypes = ['section', 'template', 'solution', 'action', 'readme'];

  // Listen for messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;

    console.log('ChangesPanel received message:', message);

    switch (message.command) {
      case 'update':
        stagedFiles = message.data.staged || [];
        unstagedFiles = message.data.changes || [];
        stepType = message.data.currentStepType || 'solution';
        commitMessage = message.data.currentStepMessage || '';
        console.log('Updated state:', { stagedFiles, unstagedFiles, stepType, commitMessage });
        break;
    }
  });

  // Handlers
  function handleCommit() {
    if (!commitMessage.trim()) {
      vscode.postMessage({
        command: 'showError',
        message: 'Commit message cannot be empty'
      });
      return;
    }

    vscode.postMessage({
      command: 'commit',
      stepType,
      message: commitMessage.trim()
    });
  }

  function stageFile(file: string) {
    vscode.postMessage({ command: 'stageFile', filePath: file });
  }

  function unstageFile(file: string) {
    vscode.postMessage({ command: 'unstageFile', filePath: file });
  }

  function discardChanges(file: string) {
    vscode.postMessage({ command: 'discardChanges', filePath: file });
  }

  function openDiff(file: string) {
    vscode.postMessage({ command: 'openDiff', filePath: file });
  }

  function stageAll() {
    vscode.postMessage({ command: 'stageAll' });
  }

  function unstageAll() {
    vscode.postMessage({ command: 'unstageAll' });
  }

  function getFileIcon(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'symbol-method';
      case 'js': case 'jsx': return 'symbol-method';
      case 'json': return 'symbol-namespace';
      case 'md': return 'markdown';
      case 'css': case 'scss': return 'symbol-color';
      case 'html': return 'symbol-misc';
      default: return 'file';
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'modified': return 'M';
      case 'untracked': return 'U';
      case 'deleted': return 'D';
      default: return status.charAt(0).toUpperCase();
    }
  }

  // Notify extension that webview is ready
  $effect(() => {
    console.log('ChangesPanel ready, sending ready message');
    vscode.postMessage({ command: 'ready' });
  });
</script>

<div class="changes-panel">
  <!-- Step Type Selection -->
  <div class="section">
    <label for="stepType">Step Type</label>
    <select id="stepType" bind:value={stepType}>
      {#each stepTypes as type}
        <option value={type}>{type}</option>
      {/each}
    </select>
  </div>

  <!-- Commit Message -->
  <div class="section">
    <label for="commitMessage">Commit Message</label>
    <textarea
      id="commitMessage"
      bind:value={commitMessage}
      placeholder="Enter step message..."
      rows="3"
    >
    </textarea>
  </div>

  <!-- Commit Button -->
  <div class="section">
    <button class="commit-btn" onclick={handleCommit}>
      <span class="codicon codicon-check"></span>
      Commit
    </button>
  </div>

  <!-- Staged Changes -->
  <div class="file-section">
    <div class="section-header" onclick={() => stagedCollapsed = !stagedCollapsed} >
      <div class="section-title">
        <span class="collapse-icon">{stagedCollapsed ? '▶' : '▼'}</span>
        <span>Staged Changes</span>
      </div>
      <span class="count-badge">{stagedFiles.length}</span>
    </div>

    {#if !stagedCollapsed}
      <ul class="file-list">
        {#each stagedFiles as file}
          <li class="file-item">
            <span class="codicon codicon-{getFileIcon(file.path)} file-icon"></span>
            <span class="file-name">{file.path}</span>
            <span class="file-status status-staged">staged</span>
            <div class="file-actions">
              <button
                class="action-icon"
                onclick={() => openDiff(file.path)}
                title="Open Changes"
              >
                <span class="codicon codicon-go-to-file"></span>
              </button>
              <button
                class="action-icon"
                onclick={() => unstageFile(file.path)}
                title="Unstage"
              >
                <span class="codicon codicon-remove"></span>
              </button>
            </div>
          </li>
        {/each}
        {#if stagedFiles.length > 0}
          <li class="file-item action-row">
            <button class="link-button" onclick={unstageAll}>
              Unstage All Changes
            </button>
          </li>
        {/if}
      </ul>
    {/if}
  </div>

  <!-- Changes -->
  <div class="file-section">
    <div class="section-header" onclick={() => changesCollapsed = !changesCollapsed}>
      <div class="section-title">
        <span class="collapse-icon">{changesCollapsed ? '▶' : '▼'}</span>
        <span>Changes</span>
      </div>
      <span class="count-badge">{unstagedFiles.length}</span>
    </div>

    {#if !changesCollapsed}
      <ul class="file-list">
        {#each unstagedFiles as file}
          <li class="file-item">
            <span class="codicon codicon-{getFileIcon(file.path)} file-icon"></span>
            <span class="file-name">{file.path}</span>
            <span class="file-status status-{file.status}">{getStatusLabel(file.status)}</span>
            <div class="file-actions">
              <button
                class="action-icon"
                onclick={() => openDiff(file.path)}
                title="Open Changes"
              >
                <span class="codicon codicon-go-to-file"></span>
              </button>
              <button
                class="action-icon"
                onclick={() => stageFile(file.path)}
                title="Stage Changes"
              >
                <span class="codicon codicon-add"></span>
              </button>
              <button
                class="action-icon"
                onclick={() => discardChanges(file.path)}
                title="Discard Changes"
              >
                <span class="codicon codicon-discard"></span>
              </button>
            </div>
          </li>
        {/each}
        {#if unstagedFiles.length > 0}
          <li class="file-item action-row">
            <button class="link-button" onclick={stageAll}>
              Stage All Changes
            </button>
          </li>
        {/if}
      </ul>
    {/if}
  </div>
</div>

<style>
  .changes-panel {
    padding: 8px;
    color: var(--vscode-foreground);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    height: 100%;
    overflow-y: auto;
  }

  .section {
    margin-bottom: 12px;
  }

  label {
    display: block;
    margin-bottom: 4px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vscode-foreground);
    text-transform: uppercase;
  }

  select, textarea {
    width: 100%;
    padding: 4px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 2px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    box-sizing: border-box;
  }

  select:focus, textarea:focus {
    outline: 1px solid var(--vscode-focusBorder);
  }

  textarea {
    resize: vertical;
    min-height: 60px;
  }

  .commit-btn {
    width: 100%;
    padding: 6px 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .commit-btn:hover {
    background: var(--vscode-button-hoverBackground);
  }

  .file-section {
    margin-top: 16px;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    cursor: pointer;
    user-select: none;
    background: var(--vscode-sideBarSectionHeader-background);
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
  }

  .section-header:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
  }

  .collapse-icon {
    font-size: 10px;
  }

  .count-badge {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .file-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .file-item:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .file-icon {
    flex-shrink: 0;
    opacity: 0.8;
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-status {
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 2px;
    font-weight: 600;
  }

  .status-M {
    color: var(--vscode-gitDecoration-modifiedResourceForeground);
  }

  .status-U {
    color: var(--vscode-gitDecoration-untrackedResourceForeground);
  }

  .status-D {
    color: var(--vscode-gitDecoration-deletedResourceForeground);
  }

  .status-staged {
    color: var(--vscode-gitDecoration-addedResourceForeground);
  }

  .file-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .file-item:hover .file-actions {
    opacity: 1;
  }

  .action-icon {
    background: transparent;
    border: none;
    padding: 2px 4px;
    cursor: pointer;
    color: var(--vscode-foreground);
    display: flex;
    align-items: center;
  }

  .action-icon:hover {
    background: var(--vscode-toolbar-hoverBackground);
  }

  .action-row {
    justify-content: center;
    padding: 8px;
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
  }

  .link-button {
    background: transparent;
    border: none;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: 12px;
    text-decoration: underline;
  }

  .link-button:hover {
    color: var(--vscode-textLink-activeForeground);
  }
</style>
