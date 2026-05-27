import { resolve, normalize } from 'path';
import { existsSync } from 'fs';

let workspacePath: string | null = null;

export function setWorkspacePath(path: string | null): void {
  workspacePath = path;
}

export function getWorkspacePath(): string | null {
  return workspacePath;
}

export function requireWorkspace(): string {
  if (!workspacePath) {
    throw new Error('Open a project folder first.');
  }
  return workspacePath;
}

/** Resolve relative path inside workspace; block traversal and install dir writes. */
export function resolveInWorkspace(inputPath: string, workspace?: string | null): string {
  const root = workspace ?? workspacePath;
  if (!root) {
    throw new Error('No workspace open. Open a project folder first.');
  }

  const rootResolved = resolve(root);
  let target: string;

  if (/^[A-Za-z]:[\\/]/.test(inputPath) || inputPath.startsWith('/')) {
    target = resolve(inputPath);
  } else {
    target = resolve(rootResolved, inputPath.replace(/\//g, '\\'));
  }

  const normalizedRoot = normalize(rootResolved).toLowerCase();
  const normalizedTarget = normalize(target).toLowerCase();

  if (
    normalizedTarget !== normalizedRoot &&
    !normalizedTarget.startsWith(normalizedRoot + '\\') &&
    !normalizedTarget.startsWith(normalizedRoot + '/')
  ) {
    throw new Error(`Path outside workspace: ${inputPath}`);
  }

  // Block writes under Program Files (install dir accidents)
  if (
    normalizedTarget.includes('\\program files\\') ||
    normalizedTarget.includes('\\program files (x86)\\')
  ) {
    throw new Error('Cannot access Program Files. Open your project folder first.');
  }

  return target;
}

export function isValidWorkspacePath(p: string | null | undefined): p is string {
  return !!p && existsSync(p);
}
