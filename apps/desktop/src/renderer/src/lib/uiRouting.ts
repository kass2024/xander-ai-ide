export const CLAUDE_UI_MODEL = 'claude-sonnet-4-20250514';

const UI_KEYWORDS = [
  'ui', 'ux', 'interface', 'design', 'layout', 'styling', 'css', 'tailwind',
  'html', 'frontend', 'landing page', 'dashboard', 'navbar', 'sidebar', 'modal',
  'dialog', 'button', 'form', 'responsive', 'mobile-friendly', 'dark mode', 'theme',
  'animation', 'hero', 'component', 'tsx', 'jsx', 'vue', 'svelte', 'styled', 'scss',
  'sass', 'bootstrap', 'material-ui', 'mui', 'shadcn', 'chakra', 'figma', 'wireframe',
  'mockup', 'gradient', 'countdown', 'timer', 'website', 'web page', 'web app',
  'login page', 'signup', 'portfolio', 'checkout', 'cart', 'gallery', 'carousel',
  'slider', 'toast', 'tooltip', 'dropdown', 'menu', 'header', 'footer', 'card',
  'grid', 'flexbox', 'appearance', 'look and feel', 'polish', 'screenshot', 'visual',
  'page design', 'color scheme', 'typography', 'icon', 'banner', 'splash',
];

const UI_FILE_PATTERN = /\.(tsx|jsx|vue|svelte|css|scss|sass|less|html|htm|astro)$/i;

export function isUiRelatedTask(text: string, filePaths?: string[]): boolean {
  if (!text && !filePaths?.length) return false;

  if (filePaths?.some((p) => UI_FILE_PATTERN.test(p))) return true;

  const lower = (text || '').toLowerCase();
  if (UI_KEYWORDS.some((k) => lower.includes(k))) return true;

  if (
    /\b(make|build|create|design|style|polish|improve|fix|update|redesign)\b.{0,40}\b(ui|interface|look|appearance|layout|page|screen|view|frontend|component)\b/i.test(
      text,
    )
  ) {
    return true;
  }

  if (/\b(css|tailwind|bootstrap|styled-components|emotion|chakra)\b/i.test(text)) return true;

  return false;
}

/** Resolve model for auto mode — Claude for UI-heavy tasks and Builder. */
export function resolveModelForPrompt(
  model: string | undefined,
  prompt: string,
  opts?: { builder?: boolean; composer?: boolean; hasImages?: boolean; filePaths?: string[] },
): string | undefined {
  if (model && model !== 'auto') return model;

  if (opts?.builder || opts?.composer) return CLAUDE_UI_MODEL;
  if (opts?.hasImages) return CLAUDE_UI_MODEL;
  if (isUiRelatedTask(prompt, opts?.filePaths)) return CLAUDE_UI_MODEL;

  return undefined;
}
