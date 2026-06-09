/** Detect whether the user wants action (not just Q&A) and extract paths. */

const ACTION_VERBS =
  /\b(convert|create|build|fix|implement|add|update|refactor|migrate|install|run|deploy|write|edit|change|improve|setup|set up|scaffold|generate|convertir)\b/i;

const QUESTION_ONLY =
  /^(what|how|why|when|where|who|explain|describe|tell me|what is|how does)\b/i;

const FAKE_CHAT_PATTERNS =
  /\b(would you like|shall i|do you want me to|let me know if|i can help you understand)\b/i;

export function isActionPrompt(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  if (QUESTION_ONLY.test(t) && !ACTION_VERBS.test(t)) return false;
  return ACTION_VERBS.test(t);
}

/** Extract Windows/Unix paths from user text */
export function extractPathFromPrompt(prompt: string): string | null {
  const win = prompt.match(/[A-Za-z]:[\\/](?:[^\s"',`]+[\\/])*[^\s"',`]+/);
  if (win) return win[0].replace(/[.,;:!?]+$/, '');
  const unix = prompt.match(/\/(?:[^\s"',`]+[\\/])*[^\s"',`]+/);
  if (unix && unix[0].length > 2) return unix[0].replace(/[.,;:!?]+$/, '');
  return null;
}

export function isPhpToReactTask(prompt: string): boolean {
  return /\b(convert|migration|migrate|port)\b/i.test(prompt)
    && /\b(php|laravel|xampp)\b/i.test(prompt)
    && /\b(react|reactjs|react js|vite)\b/i.test(prompt);
}

export function buildLocalTaskPlan(prompt: string, projectPath: string): string[] {
  if (isPhpToReactTask(prompt)) {
    return [
      'Scan PHP project structure',
      'Read PHP pages, includes, and assets',
      'Create React + Vite project scaffold',
      'Convert PHP views to React components',
      'Set up React Router routes',
      'Move CSS/images to src/assets or public',
      'Create API service layer for backend calls',
      'Run npm install',
      'Run npm build and fix errors',
      'Write README with run instructions',
    ];
  }
  if (/\b(build|npm run|compile)\b/i.test(prompt)) {
    return ['Scan project', 'Read package.json', 'Run build command', 'Fix errors from output'];
  }
  if (/\b(fix|debug|error)\b/i.test(prompt)) {
    return ['Scan project', 'Read error logs', 'Locate failing files', 'Apply fixes', 'Re-run tests'];
  }
  return [
    'Detect project path and stack',
    'Scan files and folders',
    'Read relevant source files',
    'Plan changes',
    'Create and edit files',
    'Run commands to verify',
    'Fix errors until complete',
  ];
}

export function isFakeChatbotResponse(text: string): boolean {
  return FAKE_CHAT_PATTERNS.test(text);
}
