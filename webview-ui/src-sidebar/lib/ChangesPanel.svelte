<script lang="ts">
  import { Domain } from '@gitorial/shared-types';
  import type { UI } from '@gitorial/shared-types';
  import TreeItem from './TreeItem.svelte';
  import Tab from './Tab.svelte';
  import Button from './Button.svelte';
  import { sidebarStore } from './stores/sidebarStore.svelte';
  import { sendMessage } from './utils/messaging';

  const stepTypes: readonly Domain.Commit.Type[] = Domain.Commit.Types;

  window.addEventListener('message', (event: MessageEvent<UI.Messages.ExtensionToSidebarMessage>) => {
    const message = event.data;
    console.log('ChangesPanel received message:', message);
    sidebarStore.handleMessage(message);
  });

  function handleValidate() {
    if (!sidebarStore.stepMessage.trim()) {
      sendMessage({
        type    : 'showError',
        payload : { message: 'Commit message cannot be empty' },
      });
      return;
    }

    sendMessage({
      type    : 'validate',
      payload : { stepType: sidebarStore.stepType, message: sidebarStore.stepMessage.trim() },
    });
  }

  const stageFile = (file: string) => sendMessage({type: "stageFile", payload: { filePath: file }});
  const unstageFile = (file: string) => sendMessage({type: "unstageFile", payload: { filePath: file }})
  const discardChanges = (file: string) => sendMessage({type: "discardChanges", payload: { filePath: file }})
  const openDiff = (file: string) => sendMessage({type: "openDiff", payload: { filePath: file }})
  const openFile = (file: string) => sendMessage({type: "openFile", payload: { filePath: file }})
  const stageAll = () => sendMessage({type: "stageAll" })
  const unstageAll = () => sendMessage({type: "unstageAll" })

  const getFileName = (filePath: string): string => filePath.split('/').pop() || filePath;

  $effect(() => {
    console.log('ChangesPanel ready, sending ready message');
    sendMessage({type: "ready" })
  });
</script>

<div class="changes-panel">
  <!-- Step Type Selection -->
  <div class="section">
    <label for="stepType">Step Type</label>
    <select id="stepType" bind:value={sidebarStore.stepType}>
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
      bind:value={sidebarStore.stepMessage}
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
      disabled={!sidebarStore.stepMessage.trim() || sidebarStore.stagedFiles.length === 0}
    />
  </div>

  <!-- Staged Changes -->
  <div class="file-section">
    <Tab
      title="Staged Changes"
      count={sidebarStore.stagedFiles.length}
      isCollapsed={sidebarStore.stagedCollapsed}
      onToggle={() => sidebarStore.stagedCollapsed = !sidebarStore.stagedCollapsed}
      actions={[{icon: 'remove', label: 'Unstage All Changes', onClick: unstageAll}]}
    />

    {#if !sidebarStore.stagedCollapsed}
      <ul class="file-list">
        {#each sidebarStore.stagedFiles as file}
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
      count={sidebarStore.unstagedFiles.length}
      isCollapsed={sidebarStore.changesCollapsed}
      onToggle={() => sidebarStore.changesCollapsed = !sidebarStore.changesCollapsed}
      actions={[{icon: 'add', label: 'Stage All Changes', onClick: stageAll}]}
    />

    {#if !sidebarStore.changesCollapsed}
      <ul class="file-list">
        {#each sidebarStore.unstagedFiles as file}
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
