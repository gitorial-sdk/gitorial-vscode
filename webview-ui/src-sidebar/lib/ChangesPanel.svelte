<script lang="ts">
  import { vscode } from '@shared/utils/vscode';
  import { Domain } from '@gitorial/shared-types';
  import TreeItem from './TreeItem.svelte';
  import Tab from './Tab.svelte';
  import Button from './Button.svelte';

  // State
  let stepType = $state<Domain.Commit.Type>('solution');
  let stepMessage = $state('');
  let stagedFiles = $state<Array<{ path: string; status: string }>>([]);
  let unstagedFiles = $state<Array<{ path: string; status: string }>>([]);
  let stagedCollapsed = $state(false);
  let changesCollapsed = $state(false);

  // Available step types
  const stepTypes: readonly Domain.Commit.Type[] = Domain.Commit.Types;

  // Listen for messages from extension
  window.addEventListener('message', (event) => {
    const message = event.data;
    console.log('ChangesPanel received message:', message);

    switch (message.command) {
      case 'update':
        stagedFiles = message.data.staged || [];
        unstagedFiles = message.data.changes || [];
        stepType = message.data.currentStepType || 'solution';
        stepMessage = message.data.currentStepMessage || '';
        console.log('Updated state:', { stagedFiles, unstagedFiles, stepType, stepMessage });
        break;
    }
  });

  // Handlers
  function handleValidate() {
    if (!stepMessage.trim()) {
      vscode.postMessage({
        command: 'showError',
        message: 'Commit message cannot be empty'
      });
      return;
    }

    vscode.postMessage({
      command: 'validateStep',
      stepType,
      message: stepMessage.trim()
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

  function openFile(file: string) {
    vscode.postMessage({command: 'openFile', filePath: file});
  }

  function getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
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

  <!-- Step Message -->
  <div class="section">
    <label for="stepMessage">Step Message</label>
    <textarea
      id="stepMessage"
      bind:value={stepMessage}
      placeholder="Enter step message..."
      rows="3"
    ></textarea>
  </div>

  <!-- Commit Button -->
  <div class="section">
    <Button
      label="Validate"
      icon="validate"
      onClick={handleValidate}
      disabled={!stepMessage.trim() || stagedFiles.length === 0}
    />
  </div>

  <!-- Staged Changes -->
  <div class="file-section">
    <Tab
      title="Staged Changes"
      count={stagedFiles.length}
      isCollapsed={stagedCollapsed}
      onToggle={() => stagedCollapsed = !stagedCollapsed}
      actions={[{icon: 'remove', label: 'Unstage All Changes', onClick: unstageAll}]}
    />

    {#if !stagedCollapsed}
      <ul class="file-list">
        {#each stagedFiles as file}
          <TreeItem
            fileName={getFileName(file.path)}
            filePath={file.path}
            status={file.status as 'M' | 'U' | 'D'}
            onOpenFile={openFile}
            onOpenDiff={openDiff}
            onUnstage={unstageFile}
          />
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Changes -->
  <div class="file-section">
    <Tab
      title="Changes"
      count={unstagedFiles.length}
      isCollapsed={changesCollapsed}
      onToggle={() => changesCollapsed = !changesCollapsed}
      actions={[{icon: 'add', label: 'Stage All Changes', onClick: stageAll}]}
    />

    {#if !changesCollapsed}
      <ul class="file-list">
        {#each unstagedFiles as file}
          <TreeItem
            fileName={getFileName(file.path)}
            filePath={file.path}
            status={file.status as 'M' | 'U' | 'D'}
            onOpenFile={openFile}
            onOpenDiff={openDiff}
            onStage={stageFile}
            onDiscard={discardChanges}
          />
        {/each}
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

  .file-section {
    margin-top: 16px;
  }

  .file-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
</style>
