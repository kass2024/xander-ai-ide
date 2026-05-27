import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('list')
  async listFiles(@Body() body: { path: string }) {
    return this.filesService.listFiles(body.path);
  }

  @Post('read')
  async readFile(@Body() body: { path: string }) {
    return this.filesService.readFile(body.path);
  }

  @Post('write')
  async writeFile(@Body() body: { path: string; content: string }) {
    return this.filesService.writeFile(body.path, body.content);
  }

  @Post('create')
  async createFile(@Body() body: { path: string }) {
    return this.filesService.createFile(body.path);
  }

  @Post('create-folder')
  async createFolder(@Body() body: { path: string }) {
    return this.filesService.createFolder(body.path);
  }

  @Post('delete')
  async deleteFile(@Body() body: { path: string }) {
    return this.filesService.deleteFile(body.path);
  }

  @Post('rename')
  async renameFile(@Body() body: { oldPath: string; newPath: string }) {
    return this.filesService.renameFile(body.oldPath, body.newPath);
  }

  @Post('search')
  async searchFiles(@Body() body: { path: string; query: string; include?: string; exclude?: string; maxResults?: number }) {
    return this.filesService.searchFiles(body.path, body.query, {
      include: body.include,
      exclude: body.exclude,
      maxResults: body.maxResults
    });
  }

  @Get('workspace')
  async getWorkspace() {
    return this.filesService.getWorkspace();
  }
}
