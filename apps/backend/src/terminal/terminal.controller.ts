import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TerminalService } from './terminal.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('terminal')
@UseGuards(JwtAuthGuard)
export class TerminalController {
  constructor(private readonly terminalService: TerminalService) {}

  @Post('execute')
  async executeCommand(@Body() body: { command: string; cwd?: string }) {
    return this.terminalService.executeCommand(body.command, body.cwd);
  }

  @Post('create-shell')
  async createShell(@Body() body: { cwd?: string }) {
    return this.terminalService.createShell(body.cwd);
  }

  @Post('shell-input')
  async shellInput(@Body() body: { shellId: string; input: string }) {
    return this.terminalService.shellInput(body.shellId, body.input);
  }

  @Post('shell-resize')
  async shellResize(@Body() body: { shellId: string; cols: number; rows: number }) {
    return this.terminalService.shellResize(body.shellId, body.cols, body.rows);
  }

  @Post('shell-close')
  async shellClose(@Body() body: { shellId: string }) {
    return this.terminalService.shellClose(body.shellId);
  }
}
