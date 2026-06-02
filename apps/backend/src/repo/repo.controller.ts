import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RepoService } from './repo.service';
import { RateLimitService } from '../common/rate-limit.service';
import { assertUserRequestedOpenAI } from '../ai/openai-request.guard';

@Controller('repo')
@UseGuards(JwtAuthGuard)
export class RepoController {
  constructor(
    private repoService: RepoService,
    private rateLimit: RateLimitService,
  ) {}

  @Post('index')
  async index(@Request() req, @Body() body: { rootPath: string; userRequested?: boolean }) {
    assertUserRequestedOpenAI(body, 'Repository indexing');
    await this.rateLimit.checkAiRateLimit(req.user.id);
    return this.repoService.indexRepository(req.user.id, body.rootPath);
  }

  @Post('index-chunks')
  async indexChunks(
    @Request() req,
    @Body() body: {
      rootPath: string;
      userRequested?: boolean;
      chunks: Array<{ path: string; content: string; chunkIndex?: number }>;
    },
  ) {
    assertUserRequestedOpenAI(body, 'Repository indexing');
    await this.rateLimit.checkAiRateLimit(req.user.id);
    return this.repoService.indexChunks(req.user.id, body.rootPath, body.chunks);
  }

  @Post('search')
  async search(@Request() req, @Body() body: { query: string; limit?: number; userRequested?: boolean }) {
    assertUserRequestedOpenAI(body, 'Semantic search');
    await this.rateLimit.checkAiRateLimit(req.user.id);
    return this.repoService.searchContext(req.user.id, body.query, body.limit);
  }

  @Post('health')
  health() {
    return { qdrant: this.repoService.isConfigured() };
  }
}
