<script lang="ts">
  import { type SidebarState } from './stores/sidebarStore.svelte'
  /**
   * Status Panel component to provide feebback during commit editing operations
   */

  interface Props {
    status: SidebarState['commitEditingStatus'];
  }

  let {
    status
  }: Props = $props();
</script>


  {#if status === 'Conflict'}
    <div class="status-panel status-panel-conflict">
      <p class="status-panel-text">Conflict detected</p>
    </div>
    {:else if status === 'Saving'}
      <div class="status-panel status-panel-saving">
        <p class="status-panel-text">Saving...</p>
      </div>
  {:else if status === 'Success'}
    <div class="status-panel status-panel-success">
      <p class="status-panel-text">Success</p>
    </div>
  {:else if status === 'Editing'}
    <div class="status-panel status-panel-editing">
      <p class="status-panel-text">Editing</p>
    </div>
  {/if}

<style>
  .status-panel {
    padding: 0.25rem 0.5rem;
    margin-bottom: 0.5rem;
    border-radius: 2px;
    font-size: 0.75rem;
    font-weight: 400;

    display: flex;
    justify-content: center;
    align-items: center;
  }

  .status-panel-conflict {
    background-color: var(--vscode-inputValidation-errorBackground);
    color: var(--vscode-inputValidation-errorForeground);
    border: 1px solid var(--vscode-inputValidation-errorBackground);
  }

  .status-panel-success {
    background-color: var(--vscode-input-background);
    color: var(--vscode-charts-green);
    border: 1px solid var(--vscode-charts-green);
  }

  .status-panel-saving {
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
  }

  .status-panel-editing {
    background-color: transparent;
    color: transparent;
    border: 1px solid transparent;
  }

  .status-panel-text {
    margin: 0;
    font-size: inherit;
    font-weight: inherit;
  }
</style>
