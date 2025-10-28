<script lang="ts">
  /**
   * Shared Button component for all webview apps
   * Supports icons, variants, loading state, and disabled state
   */

  interface Props {
    label: string;
    icon?: string;
    variant?: 'primary' | 'secondary' | 'link';
    disabled?: boolean;
    fullWidth?: boolean;
    onClick: () => void;
  }

  let {
    label,
    icon,
    variant = 'primary',
    disabled = false,
    fullWidth = false,
    onClick
  }: Props = $props();
</script>

<button
  class="btn btn-{variant}"
  class:full-width={fullWidth}
  onclick={onClick}
  disabled={disabled}
  aria-label={label}
>
  {#if icon}
    <span class="codicon codicon-{icon}"></span>
  {/if}
  {label}
</button>

<style>
  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 2px;
    cursor: pointer;
    font-weight: 600;
    font-size: var(--vscode-font-size);
    font-family: var(--vscode-font-family);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.1s;
  }

  .btn.full-width {
    width: 100%;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--vscode-button-hoverBackground);
  }

  .btn-primary:active:not(:disabled) {
    opacity: 0.9;
  }

  .btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground);
  }

  .btn-link {
    background: transparent;
    color: var(--vscode-textLink-foreground);
    text-decoration: underline;
    padding: 4px 8px;
  }

  .btn-link:hover:not(:disabled) {
    color: var(--vscode-textLink-activeForeground);
  }
</style>
