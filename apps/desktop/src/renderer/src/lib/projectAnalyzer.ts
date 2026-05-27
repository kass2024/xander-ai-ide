/**
 * Project analyzer — scans workspace, detects stacks, builds agent summary.
 */

const IGNORED_DIRS = new Set([
  'node_modules', 'vendor', '.git', 'dist', 'build', '.next', 'release', 'out',
  '.cache', 'coverage', 'storage', 'logs', 'uploads', 'tmp', 'temp', '.turbo',
  'vendor', 'bootstrap/cache', 'public/build',
]);

const IGNORED_FILES = new Set(['.env', '.env.local', '.env.production']);

export type DetectedStack =
  | 'laravel'
  | 'php'
  | 'react'
  | 'nextjs'
  | 'nodejs'
  | 'express'
  | 'electron'
  | 'python'
  | 'mysql'
  | 'typescript';

export interface ProjectAnalysis {
  rootPath: string;
  fileCount: number;
  dirCount: number;
  stacks: DetectedStack[];
  importantFiles: string[];
  summary: string;
  treePreview: string;
}

function rel(root: string, full: string): string {
  const norm = full.replace(/\\/g, '/');
  const base = root.replace(/\\/g, '/').replace(/\/$/, '');
  if (norm.startsWith(base + '/')) return norm.slice(base.length + 1);
  if (norm.startsWith(base)) return norm.slice(base.length).replace(/^\//, '');
  return full;
}

export async function analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
  const api = window.electronAPI;
  const stacks = new Set<DetectedStack>();
  const importantFiles: string[] = [];
  let fileCount = 0;
  let dirCount = 0;
  const treeLines: string[] = [];

  if (!api?.walkProjectFiles) {
    return {
      rootPath: projectPath,
      fileCount: 0,
      dirCount: 0,
      stacks: [],
      importantFiles: [],
      summary: 'Project analyzer unavailable.',
      treePreview: '',
    };
  }

  const walk = await api.walkProjectFiles(projectPath);
  if (!walk.success || !walk.files) {
    return {
      rootPath: projectPath,
      fileCount: 0,
      dirCount: 0,
      stacks: [],
      importantFiles: [],
      summary: 'Could not walk project files.',
      treePreview: '',
    };
  }

  const markers: Record<string, boolean> = {};

  for (const f of walk.files) {
    const parts = f.path.replace(/\\/g, '/').split('/');
    if (parts.some((p) => IGNORED_DIRS.has(p))) continue;

    const name = f.name.toLowerCase();
    const r = rel(projectPath, f.path);

    if (f.isDirectory) {
      dirCount++;
      if (treeLines.length < 80 && parts.length <= 4) {
        treeLines.push(`${'  '.repeat(Math.min(parts.length - 1, 3))}📁 ${f.name}`);
      }
      continue;
    }

    fileCount++;
    if (IGNORED_FILES.has(name)) continue;

    const check = (key: string, path: string) => {
      if (r === path || r.endsWith('/' + path) || name === path) markers[key] = true;
    };

    check('package.json', 'package.json');
    check('composer.json', 'composer.json');
    check('vite.config', 'vite.config.ts');
    check('vite.config.js', 'vite.config.js');
    check('tsconfig', 'tsconfig.json');
    check('env.example', '.env.example');
    check('artisan', 'artisan');
    check('electron', 'electron');
    check('next.config', 'next.config.js');
    check('next.config.ts', 'next.config.ts');
    check('requirements.txt', 'requirements.txt');
    check('manage.py', 'manage.py');

    if (r.includes('/routes/') || r.includes('\\routes\\')) markers.routes = true;
    if (r.includes('/Controllers/') || r.includes('/controllers/')) markers.controllers = true;
    if (r.includes('/models/') || r.includes('/Models/')) markers.models = true;
    if (r.includes('/migrations/')) markers.migrations = true;
    if (r.includes('/views/') || r.includes('/resources/views/')) markers.views = true;
    if (r.includes('/api/') || name.includes('api')) markers.api = true;

    const importantPatterns = [
      /^package\.json$/,
      /^composer\.json$/,
      /^vite\.config/,
      /^tsconfig\.json$/,
      /^\.env\.example$/,
      /^artisan$/,
      /^next\.config/,
      /routes\/web\.php$/,
      /routes\/api\.php$/,
      /app\.php$/,
      /server\.(js|ts)$/,
      /main\.(ts|js)$/,
      /index\.(tsx?|jsx?)$/,
    ];

    for (const pat of importantPatterns) {
      if (pat.test(r.replace(/\\/g, '/'))) {
        if (importantFiles.length < 40 && !importantFiles.includes(r)) {
          importantFiles.push(r);
        }
        break;
      }
    }
  }

  if (markers['composer.json'] || markers.artisan) stacks.add('laravel');
  if (markers['composer.json'] && !markers.artisan) stacks.add('php');
  if (markers['package.json']) {
    stacks.add('nodejs');
    if (markers.electron) stacks.add('electron');
    if (markers['next.config'] || markers['next.config.ts']) stacks.add('nextjs');
    if (markers['vite.config'] || markers['vite.config.js']) stacks.add('react');
    if (markers['tsconfig']) stacks.add('typescript');
  }
  if (markers['requirements.txt'] || markers['manage.py']) stacks.add('python');

  const dbHints = walk.files.some((f) =>
    /\.sql$|database\.php|\.env\.example|schema\.prisma/i.test(f.path),
  );
  if (dbHints) stacks.add('mysql');

  const stackList = [...stacks];
  const parts: string[] = [
    `Root: ${projectPath}`,
    `Files: ${fileCount}, directories: ${dirCount}`,
    stackList.length ? `Stacks: ${stackList.join(', ')}` : 'Stacks: (generic)',
  ];
  if (importantFiles.length) {
    parts.push(`Key files:\n${importantFiles.slice(0, 25).map((f) => `  - ${f}`).join('\n')}`);
  }
  if (markers.routes) parts.push('- Has routes');
  if (markers.controllers) parts.push('- Has controllers');
  if (markers.models) parts.push('- Has models');
  if (markers.migrations) parts.push('- Has migrations');
  if (markers.views) parts.push('- Has views');
  if (markers.api) parts.push('- Has API layer');

  return {
    rootPath: projectPath,
    fileCount,
    dirCount,
    stacks: stackList,
    importantFiles: importantFiles.slice(0, 40),
    summary: parts.join('\n'),
    treePreview: treeLines.slice(0, 60).join('\n'),
  };
}

export function formatAnalysisForAgent(analysis: ProjectAnalysis): string {
  return `## Project analysis\n${analysis.summary}\n\n### Tree preview\n${analysis.treePreview || '(truncated)'}`;
}
