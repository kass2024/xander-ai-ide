import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RepoService } from './repo.service';
import { RateLimitService } from '../common/rate-limit.service';

@Controller('repo')
@UseGuards(JwtAuthGuard)
export class RepoController {
  constructor(
    private repoService: RepoService,
    private rateLimit: RateLimitService,
  ) {}

  @Post('index')
  async index(@Request() req, @Body() body: { rootPath: string }) {
    await this.rateLimit.checkAiRateLimit(req.user.id);
    return this.repoService.indexRepository(req.user.id, body.rootPath);
  }

  @Post('index-chunks')
  async indexChunks(
    @Request() req,
    @Body() body: { rootPath: string; chunks: Array<{ path: string; content: string; chunkIndex?: number }> },
  ) {
    await this.rateLimit.checkAiRateLimit(req.user.id);
    return this.repoService.indexChunks(req.user.id, body.rootPath, body.chunks);
  }

  @Post('search')
  async search(@Request() req, @Body() body: { query: string; limit?: number }) {
    await this.rateLimit.checkAiRateLimit(req.user.id);
    return this.repoService.searchContext(req.user.id, body.query, body.limit);
  }

  @Post('health')
  health() {
    return { qdrant: this.repoService.isConfigured() };
  }
}
