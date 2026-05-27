import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next']);

@Injectable()
export class FilesService {
  async listFiles(dirPath: string): Promise<any[]> {
    try {
      const files = await fs.readdir(dirPath);
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modified: stats.mtime,
            created: stats.birthtime,
          };
        }),
      );

      return fileStats.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  async readFile(filePath: string): Promise<{ content: string }> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { content };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<{ success: boolean }> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  async createFile(filePath: string): Promise<{ success: boolean }> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, '', 'utf-8');
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to create file: ${error.message}`);
    }
  }

  async createFolder(dirPath: string): Promise<{ success: boolean }> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to create folder: ${error.message}`);
    }
  }

  async deleteFile(filePath: string): Promise<{ success: boolean }> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
      } else {
        await fs.unlink(filePath);
      }
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<{ success: boolean }> {
    try {
      await fs.mkdir(path.dirname(newPath), { recursive: true });
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to rename file: ${error.message}`);
    }
  }

  async searchFiles(
    rootPath: string,
    query: string,
    options?: {
      include?: string;
      exclude?: string;
      maxResults?: number;
    },
  ): Promise<any[]> {
    try {
      const maxResults = options?.maxResults || 100;
      const results: any[] = [];
      const normalizedQuery = query.toLowerCase();

      await this.walkFiles(rootPath, rootPath, async (relativePath, absolutePath) => {
        if (results.length >= maxResults) return;

        try {
          const content = await fs.readFile(absolutePath, 'utf-8');
          if (content.toLowerCase().includes(normalizedQuery)) {
            results.push({
              name: path.basename(relativePath),
              path: absolutePath,
              type: 'file',
              matches: content.match(new RegExp(query, 'gi'))?.length || 0,
            });
          }
        } catch {
          // Skip unreadable files
        }
      });

      return results;
    } catch (error) {
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  async getWorkspace(): Promise<{ path: string }> {
    const defaultPath = process.env.WORKSPACE_PATH || path.join(process.cwd(), 'workspace');
    return { path: defaultPath };
  }

  private async walkFiles(
    rootPath: string,
    currentPath: string,
    onFile: (relativePath: string, absolutePath: string) => Promise<void>,
  ): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath);

      if (entry.isDirectory()) {
        await this.walkFiles(rootPath, absolutePath, onFile);
      } else if (entry.isFile()) {
        await onFile(relativePath, absolutePath);
      }
    }
  }
}
