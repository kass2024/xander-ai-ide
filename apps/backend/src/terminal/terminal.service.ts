import { Injectable } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';

@Injectable()
export class TerminalService {
  private shells = new Map<string, ChildProcess>();
  private shellCounter = 0;

  async executeCommand(command: string, cwd?: string) {
    return new Promise((resolve, reject) => {
      const isWindows = os.platform() === 'win32';
      const shell = isWindows ? 'cmd.exe' : 'bash';
      
      const child = spawn(shell, ['/c', command], {
        cwd: cwd || process.cwd(),
        stdio: 'pipe',
        shell: true
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: output.trim(),
            cwd: cwd || process.cwd()
          });
        } else {
          resolve({
            success: false,
            output: errorOutput.trim() || output.trim(),
            error: `Command failed with exit code ${code}`,
            cwd: cwd || process.cwd()
          });
        }
      });

      child.on('error', (error) => {
        reject({
          success: false,
          error: error.message,
          cwd: cwd || process.cwd()
        });
      });
    });
  }

  async createShell(cwd?: string) {
    const shellId = `shell_${++this.shellCounter}`;
    const isWindows = os.platform() === 'win32';
    const shell = isWindows ? 'cmd.exe' : 'bash';
    
    const child = spawn(shell, [], {
      cwd: cwd || process.cwd(),
      stdio: 'pipe'
    });

    this.shells.set(shellId, child);

    return {
      shellId,
      pid: child.pid,
      cwd: cwd || process.cwd()
    };
  }

  async shellInput(shellId: string, input: string) {
    const shell = this.shells.get(shellId);
    if (!shell) {
      throw new Error('Shell not found');
    }

    shell.stdin?.write(input);
    return { success: true };
  }

  async shellResize(shellId: string, cols: number, rows: number) {
    const shell = this.shells.get(shellId);
    if (!shell) {
      throw new Error('Shell not found');
    }

    // Note: resize doesn't work on Windows cmd.exe
    if (process.platform !== 'win32' && shell.pid) {
      try {
        process.kill(shell.pid, 'SIGWINCH');
      } catch (error) {
        // Ignore resize errors
      }
    }

    return { success: true };
  }

  async shellClose(shellId: string) {
    const shell = this.shells.get(shellId);
    if (!shell) {
      throw new Error('Shell not found');
    }

    shell.kill();
    this.shells.delete(shellId);
    return { success: true };
  }

  // Cleanup on application shutdown
  onModuleDestroy() {
    for (const [shellId, shell] of this.shells) {
      shell.kill();
    }
    this.shells.clear();
  }
}
