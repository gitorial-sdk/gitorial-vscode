<script lang="ts">
  interface Props {
    label: string;
    disabled?: boolean;
    onClick?: () => void;
  }
  const { label, disabled, onClick }: Props = $props();
</script>

<button class="tutorial-btn" onclick={onClick} {disabled}>
  {label}
</button>

<style>
  .tutorial-btn {
    margin: 0 8px;
    padding: 4px 12px;
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    border-radius: 2px;
    cursor: pointer;
  }
  .tutorial-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
