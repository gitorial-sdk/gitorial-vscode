<script lang="ts">
  /**
   * Tab component for collapsible sections
   * Displays: chevron icon, title, count badge, and optional action buttons on hover
   */

  interface Props {
    title: string;
    count: number;
    isCollapsed: boolean;
    onToggle: () => void;
    actions?: Array<{
      icon: string;
      label: string;
      onClick: () => void;
    }>;
  }

  let {
    title,
    count,
    isCollapsed,
    onToggle,
    actions = []
  }: Props = $props();
</script>

<div class="tab-header" onclick={onToggle} role="button" tabindex="0">
  <div class="tab-title">
    <span class="codicon codicon-chevron-{isCollapsed ? 'right' : 'down'} collapse-icon"></span>
    <span class="title-text">{title}</span>
  </div>

  <div class="tab-right">
    {#if actions.length > 0}
      <div class="tab-actions" onclick={(e) => e.stopPropagation()}>
        {#each actions as action}
          <button
            class="action-button"
            onclick={action.onClick}
            title={action.label}
            aria-label={action.label}
          >
            <span class="codicon codicon-{action.icon}"></span>
          </button>
        {/each}
      </div>
    {/if}

    <span class="count-badge">{count}</span>
  </div>
</div>

<style>

  .tab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    cursor: pointer;
    user-select: none;
    background: var(--vscode-sideBarSectionHeader-background);
    border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
  }

  .tab-header:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .tab-title {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
  }

  .collapse-icon {
    transition: transform 0.1s;
  }

  .title-text {
    color: var(--vscode-foreground);
  }

  .tab-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tab-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.15s ease, visibility 0.15s ease;
  }

  .tab-header:hover .tab-actions {
    opacity: 1;
    visibility: visible;
  }

  .action-button {
    background: transparent;
    border: none;
    padding: 2px 4px;
    cursor: pointer;
    color: var(--vscode-foreground);
    display: flex;
    align-items: center;
  }

  .action-button:hover {
    background: var(--vscode-toolbar-hoverBackground);
  }

  .count-badge {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }
</style>
