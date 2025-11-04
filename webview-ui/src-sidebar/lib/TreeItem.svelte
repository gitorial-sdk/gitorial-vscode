<script lang="ts">
  /**
   * TreeItem component for file changes
   * Displays: file icon, file name, file status, and action buttons on hover
   */

  interface Props {
    fileName: string;
    filePath: string;
    status: 'M' | 'U' | 'D' | 'C';
    onOpenDiff: (path: string) => void;
    onOpenFile: (path: string) => void;
    onStage?: (path: string) => void;
    onUnstage?: (path: string) => void;
    onDiscard?: (path: string) => void;
  }

  let {
    fileName,
    filePath,
    status,
    onOpenDiff,
    onOpenFile,
    onStage,
    onUnstage,
    onDiscard
  }: Props = $props();

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

  function getStatusLabel(status: string): string | undefined {
    switch (status) {
      case 'M': return 'M';
      case 'U': return 'U';
      case 'D': return 'D';
      case 'C': return undefined; // Conflicted files are not displayed in the tree with a status label
      default: return status.charAt(0).toUpperCase();
    }
  }
</script>

<li class="tree-item" onclick={() => onOpenDiff(filePath)} role="button" tabindex="0">
  <span class="codicon codicon-{getFileIcon(filePath)} file-icon"></span>
  <span class="file-name" class:deleted={status === 'D'} title={filePath}>{fileName}</span>

  <div class="file-actions" onclick={(e) => e.stopPropagation()}>
    <button
      class="action-icon"
      onclick={() => onOpenFile(filePath)}
      title="Open Changes"
      aria-label="Open file in editor {fileName}"
    >
      <span class="codicon codicon-go-to-file"></span>
    </button>

    {#if onStage}
      <button
        class="action-icon"
        onclick={() => onStage(filePath)}
        title="Stage Changes"
        aria-label="Stage {fileName}"
      >
        <span class="codicon codicon-add"></span>
      </button>
    {/if}

    {#if onUnstage}
      <button
        class="action-icon"
        onclick={() => onUnstage(filePath)}
        title="Unstage"
        aria-label="Unstage {fileName}"
      >
        <span class="codicon codicon-remove"></span>
      </button>
    {/if}

    {#if onDiscard}
      <button
        class="action-icon"
        onclick={() => onDiscard(filePath)}
        title="Discard Changes"
        aria-label="Discard changes in {fileName}"
      >
        <span class="codicon codicon-discard"></span>
      </button>
    {/if}
  </div>

  <span class="file-status status-{status}">{getStatusLabel(status)}</span>
</li>

<style>
  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    cursor: pointer;
  }

  .tree-item:hover {
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

  .file-name.deleted {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .file-status {
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 2px;
    font-weight: 600;
  }

  .status-modified,
  .status-M {
    color: var(--vscode-gitDecoration-modifiedResourceForeground);
  }

  .status-untracked,
  .status-U {
    color: var(--vscode-gitDecoration-untrackedResourceForeground);
  }

  .status-deleted,
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

  .tree-item:hover .file-actions {
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
</style>
