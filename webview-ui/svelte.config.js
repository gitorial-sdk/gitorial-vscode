import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  compilerOptions: {
    // Disable specific a11y warnings globally
    // Note: These warnings exist for good reason (accessibility), but can be disabled if needed
    warningFilter: (warning) => {
      // Disable keyboard event warnings for click handlers
      if (warning.code === 'a11y_click_events_have_key_events') return false;
      // Disable ARIA role warnings for interactive elements
      if (warning.code === 'a11y_no_static_element_interactions') return false;
      // Disable aria-label warnings for buttons with icons
      if (warning.code === 'a11y_consider_explicit_label') return false;
      // Disable warnings about non-interactive elements with event listeners
      if (warning.code === 'a11y_no_noninteractive_element_interactions') return false;
      // Disable warnings about non-interactive elements with interactive roles
      if (warning.code === 'a11y_no_noninteractive_element_to_interactive_role') return false;

      return true;
    }
  }
};
