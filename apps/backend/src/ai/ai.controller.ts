import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Res,
} from '@nestjs/common';
import { AiService, ChatRequest, AutocompleteRequest, ComposerRequest } from './ai.service';
import { AgentStepDto } from './agent-step.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AIRouter } from './ai.router';
import { ProjectBuilderService, ProjectBuilderRequest } from './project-builder.service';
import { MultiModelService } from './multi-model.service';
import { formatSSE } from './stream.types';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiRouter: AIRouter,
    private readonly projectBuilder: ProjectBuilderService,
    private readonly multiModel: MultiModelService,
  ) {}

  @Post('chat')
  async chat(@Request() req, @Body() chatRequest: ChatRequest): Promise<any> {
    return this.aiService.chat(req.user.id, chatRequest);
  }

  @Post('stream')
  async streamChat(@Request() req, @Body() chatRequest: ChatRequest, @Res() res): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const quota = await this.aiService.checkQuotaStatus(req.user.id);
      if (quota.warning) {
        res.write(formatSSE({
          type: 'quota_warning',
          quota: {
            used: quota.used,
            limit: quota.limit,
            warning: true,
            warningMessage: quota.warningMessage,
          },
        }));
      }

      for await (const event of this.aiService.streamChat(req.user.id, chatRequest)) {
        res.write(formatSSE(event));
      }
    } catch (err) {
      res.write(
        formatSSE({
          type: 'error',
          message: err instanceof Error ? err.message : 'Stream failed',
        }),
      );
    } finally {
      res.end();
    }
  }

  @Post('build')
  async buildProject(@Request() req, @Body() body: ProjectBuilderRequest, @Res() res): Promise<void> {
    if (!body.context?.repositoryPath) {
      res.status(400).json({ message: 'Open a workspace folder first' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const quota = await this.aiService.checkQuotaStatus(req.user.id);
      if (quota.warning) {
        res.write(formatSSE({
          type: 'quota_warning',
          quota: {
            used: quota.used,
            limit: quota.limit,
            warning: true,
            warningMessage: quota.warningMessage,
          },
        }));
      }

      const generator = this.projectBuilder.generateProject(req.user.id, body, (tokens, cost, model) => {
        this.aiService.logUsageDirect(req.user.id, 'project_builder', tokens, cost, model);
      });

      for await (const event of generator) {
        res.write(formatSSE(event));
      }
    } catch (err) {
      res.write(
        formatSSE({
          type: 'error',
          message: err instanceof Error ? err.message : 'Build failed',
        }),
      );
    } finally {
      res.end();
    }
  }

  @Post('composer/stream')
  async streamComposer(
    @Request() req,
    @Body() body: ComposerRequest,
    @Res() res,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      await this.aiService.checkUserQuota(req.user.id);

      const generator = this.projectBuilder.streamComposerGeneration(
        body.instruction,
        body.files,
        body.model,
      );

      for await (const event of generator) {
        res.write(formatSSE(event));
      }
    } catch (err) {
      res.write(
        formatSSE({
          type: 'error',
          message: err instanceof Error ? err.message : 'Composer stream failed',
        }),
      );
    } finally {
      res.end();
    }
  }

  @Post('autocomplete')
  async autocomplete(@Request() req, @Body() body: AutocompleteRequest): Promise<any> {
    return { completion: await this.aiService.autocomplete(req.user.id, body) };
  }

  @Post('agent')
  async agent(
    @Request() req,
    @Body() body: { prompt: string; context?: Record<string, unknown>; model?: string },
  ): Promise<any> {
    const model = body.model || (body.context?.model as string | undefined);
    const { model: _ignored, ...context } = body.context || {};
    return this.aiService.chat(req.user.id, {
      message: body.prompt,
      model,
      context: context as ChatRequest['context'],
      temperature: 0.3,
    });
  }

  @Get('agent/status')
  agentStatus(): { agentStep: boolean; version: string; projectBuilder: boolean; streaming: boolean } {
    return { agentStep: true, version: '2.0.0', projectBuilder: true, streaming: true };
  }

  @Get('capabilities')
  getCapabilities(): {
    projectBuilder: boolean;
    streaming: boolean;
    composerStream: boolean;
    multiModel: boolean;
    agentClaude: boolean;
    providers: { openai: boolean; anthropic: boolean; google: boolean };
    defaultRouting: { agent: string; composer: string; project_builder: string; ui_tasks: string; repo_analysis: string };
  } {
    const providers = this.multiModel.getProvidersStatus();
    const defaults = this.multiModel.getDefaultModels();
    return {
      projectBuilder: true,
      streaming: true,
      composerStream: true,
      multiModel: providers.openai || providers.anthropic || providers.google,
      agentClaude: providers.anthropic,
      providers,
      defaultRouting: {
        agent: providers.anthropic ? `claude (${defaults.claude}) for UI; openai otherwise` : 'openai',
        composer: providers.anthropic ? `claude (${defaults.claude})` : providers.google ? `gemini (${defaults.gemini})` : 'openai',
        project_builder: providers.anthropic ? `claude (${defaults.claude})` : 'openai',
        ui_tasks: providers.anthropic ? `claude (${defaults.claude})` : 'openai',
        repo_analysis: providers.google ? `gemini (${defaults.gemini})` : 'openai',
      },
    };
  }

  @Post('builder')
  async buildProjectAlias(@Request() req, @Body() body: ProjectBuilderRequest, @Res() res): Promise<void> {
    return this.buildProject(req, body, res);
  }

  @Post('project/build')
  async buildProjectAlias2(@Request() req, @Body() body: ProjectBuilderRequest, @Res() res): Promise<void> {
    return this.buildProject(req, body, res);
  }

  @Post('agent/step')
  async agentStep(@Request() req, @Body() body: AgentStepDto): Promise<any> {
    return this.aiService.agentStep(req.user.id, body);
  }

  @Post('agent/analyze-screenshot')
  async analyzeScreenshot(
    @Request() req,
    @Body() body: { images: Array<{ mediaType: string; data: string }>; prompt?: string },
  ): Promise<any> {
    return this.aiService.analyzeScreenshot(req.user.id, body.images, body.prompt);
  }

  @Post('composer')
  async composer(@Request() req, @Body() composerRequest: ComposerRequest): Promise<any> {
    return this.aiService.composer(req.user.id, composerRequest);
  }

  @Get('models')
  getModels(): any {
    const defaults = this.multiModel.getDefaultModels();
    const models = [
      { id: 'auto', name: 'Auto', description: 'Smart routing by task (recommended)', tier: 'router' },
      { id: defaults.agent, name: 'GPT-5.1', description: 'Complex coding, agent, composer, project builder', tier: 'premium' },
      { id: defaults.fast, name: 'GPT-5.1 Mini', description: 'Fast chat, autocomplete, summaries', tier: 'fast' },
      { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship multimodal model', tier: 'premium' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective', tier: 'fast' },
      { id: defaults.claude, name: 'Claude Sonnet 4.5', description: 'Code review, refactoring, reasoning', tier: 'review' },
      { id: defaults.gemini, name: 'Gemini 2.5 Pro', description: 'Huge repo analysis, architecture planning', tier: 'analysis' },
      { id: defaults.embedding, name: 'Embeddings', description: 'Repository indexing & search', tier: 'embedding' },
    ];
    if (process.env.DEEPSEEK_API_KEY) {
      models.push({ id: 'deepseek-chat', name: 'DeepSeek Chat', description: 'Cost-effective coding model', tier: 'premium' });
    }
    if (process.env.GROQ_API_KEY) {
      models.push({ id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', description: 'Ultra-fast open model via Groq', tier: 'fast' });
    }
    return { models };
  }

  @Get('providers')
  getProviders(): any {
    const providers = [
      { id: 'openai', name: 'OpenAI', configured: !!process.env.OPENAI_API_KEY, url: 'https://platform.openai.com/api-keys' },
      { id: 'anthropic', name: 'Anthropic Claude', configured: !!process.env.ANTHROPIC_API_KEY, url: 'https://console.anthropic.com/settings/keys' },
      { id: 'google', name: 'Google Gemini', configured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY), url: 'https://aistudio.google.com/apikey' },
      { id: 'deepseek', name: 'DeepSeek', configured: !!process.env.DEEPSEEK_API_KEY, url: 'https://platform.deepseek.com/api_keys' },
      { id: 'groq', name: 'Groq', configured: !!process.env.GROQ_API_KEY, url: 'https://console.groq.com/keys' },
      { id: 'ollama', name: 'Ollama (local)', configured: true, url: 'https://ollama.com/download' },
    ];
    return { providers };
  }

  @Get('health')
  async health(): Promise<any> {
    return this.aiRouter.checkHealth();
  }
}
