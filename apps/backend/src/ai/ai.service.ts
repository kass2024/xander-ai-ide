import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RateLimitService } from '../common/rate-limit.service';
import { RepoService } from '../repo/repo.service';
import {
  formatOpenAIError,
  getModelFallbacks,
  normalizeOpenAIKey,
  resolveOpenAIModel,
} from './model.utils';
import { AGENT_TOOLS, getAgentSystemPrompt } from './agent.tools';
import { ACTION_AWARE_PROMPT, parseActionsFromText } from './actions.parser';
import { MultiModelService } from './multi-model.service';
import { StreamEvent } from './stream.types';

export interface ChatRequest {
  message: string;
  conversationId?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  context?: {
    currentFile?: string;
    selectedText?: string;
    repositoryPath?: string;
    workspaceFolders?: string[];
    directoryListing?: string;
    openFiles?: string[];
    currentFileContent?: string;
    projectTree?: string;
    semanticContext?: string;
  };
}

export interface ChatResponse {
  id: string;
  content: string;
  role: string;
  tokens: number;
  cost: number;
  actions?: Array<{ type: string; path?: string; content?: string; command?: string; message?: string }>;
  reply?: string;
}

export interface AutocompleteRequest {
  prefix: string;
  suffix: string;
  filename: string;
  language: string;
  maxTokens?: number;
  /** Must be true — blocks idle/background autocomplete on the server. */
  userRequested?: boolean;
}

export interface ComposerRequest {
  instruction: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  model?: string;
}

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  name?: string;
}

export interface AgentStepRequest {
  messages: AgentMessage[];
  context?: ChatRequest['context'] & {
    currentFileContent?: string;
    projectTree?: string;
    projectSummary?: string;
    semanticContext?: string;
    agentMode?: string;
    images?: Array<{ mediaType: string; data: string; name?: string }>;
    screenshotAnalysis?: string;
  };
  model?: string;
  conversationId?: string;
}

export interface AgentStepResponse {
  conversationId: string;
  message: AgentMessage;
  finishReason: 'stop' | 'tool_calls' | 'length';
  tokens: number;
  cost: number;
  provider?: string;
  model?: string;
  screenshotAnalysis?: string;
}

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private usersService: UsersService,
    private rateLimit: RateLimitService,
    private repoService: RepoService,
    private multiModel: MultiModelService,
  ) {
    const apiKey = normalizeOpenAIKey(this.configService.get<string>('OPENAI_API_KEY'));
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private requireOpenAI(): OpenAI {
    if (!this.openai) {
      throw new BadRequestException('OPENAI_API_KEY is not configured');
    }
    return this.openai;
  }

  private getDefaultModels() {
    return {
      agent: resolveOpenAIModel(
        this.configService.get<string>('OPENAI_MODEL_AGENT'),
        'agent',
        { agent: 'gpt-4o', fast: 'gpt-4o-mini' },
      ),
      fast: resolveOpenAIModel(
        this.configService.get<string>('OPENAI_MODEL_FAST'),
        'fast',
        { agent: 'gpt-4o', fast: 'gpt-4o-mini' },
      ),
    };
  }

  private async createCompletion(
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    maxTokens: number,
    temperature: number,
  ) {
    let lastError: unknown;
    for (const candidate of getModelFallbacks(model)) {
      try {
        return await this.requireOpenAI().chat.completions.create({
          model: candidate,
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: false,
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async chat(userId: string, request: ChatRequest): Promise<ChatResponse> {
    await this.rateLimit.checkAiRateLimit(userId);
    await this.checkUserQuota(userId);

    const defaults = this.getDefaultModels();
    const model = resolveOpenAIModel(request.model, 'agent', defaults);
    const maxTokens = request.maxTokens || 4000;
    const temperature = request.temperature || 0.7;

    // Get or create conversation
    let conversationId = request.conversationId;
    if (!conversationId) {
      const conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title: this.generateTitle(request.message),
          model,
        },
      });
      conversationId = conversation.id;
    }

    // Add user message
    await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: request.message,
        metadata: request.context,
      },
    });

    // Get conversation history
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20, // Limit context
    });

    // Format messages for OpenAI
    const openaiMessages = messages.map(msg => ({
      role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    // Add system prompt
    openaiMessages.unshift({
      role: 'system',
      content: this.getSystemPrompt(request.context),
    });

    if (request.context?.repositoryPath && this.repoService.isConfigured()) {
      try {
        const { results } = await this.repoService.searchContext(userId, request.message, 5);
        if (results.length) {
          const ctx = results.map((r) => `File: ${r.path}\n${r.content}`).join('\n---\n');
          openaiMessages.splice(1, 0, {
            role: 'system',
            content: `Relevant repository context:\n${ctx}`,
          });
        }
      } catch {
        /* indexing optional */
      }
    }

    try {
      const completion = await this.createCompletion(model, openaiMessages, maxTokens, temperature);
      const usedModel = completion.model || model;
      const response = completion.choices[0]?.message?.content || '';
      const tokens = completion.usage?.total_tokens || 0;
      const cost = this.calculateCost(usedModel, tokens);

      const actions = parseActionsFromText(response);
      const displayContent = response.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim() || response;

      // Save assistant message
      await this.prisma.message.create({
        data: {
          conversationId,
          role: 'ASSISTANT',
          content: displayContent,
          tokens,
        },
      });

      // Log usage
      await this.logUsage(userId, 'chat', tokens, cost, usedModel);

      return {
        id: conversationId,
        content: displayContent,
        reply: displayContent,
        role: 'assistant',
        tokens,
        cost,
        actions: actions.length ? actions : undefined,
      };
    } catch (error) {
      throw new BadRequestException(formatOpenAIError(error));
    }
  }

  async autocomplete(userId: string, request: AutocompleteRequest): Promise<string> {
    // Check user quota
    await this.checkUserQuota(userId);

    const defaults = this.getDefaultModels();
    const model = defaults.fast;
    const maxTokens = request.maxTokens || 200;

    const prompt = this.buildAutocompletePrompt(request);

    try {
      const completion = await this.createCompletion(
        model,
        [
          {
            role: 'system',
            content: 'You are an AI coding assistant. Provide concise code completions without explanations.',
          },
          { role: 'user', content: prompt },
        ],
        maxTokens,
        0.1,
      );
      const usedModel = completion.model || model;
      const response = completion.choices[0]?.message?.content || '';
      const tokens = completion.usage?.total_tokens || 0;
      const cost = this.calculateCost(usedModel, tokens);

      // Log usage
      await this.logUsage(userId, 'autocomplete', tokens, cost, usedModel);

      return response.trim();
    } catch (error) {
      throw new BadRequestException(formatOpenAIError(error));
    }
  }

  async agentStep(userId: string, request: AgentStepRequest): Promise<AgentStepResponse> {
    await this.rateLimit.checkAiRateLimit(userId);
    await this.checkUserQuota(userId);

    const defaults = this.getDefaultModels();
    const model = resolveOpenAIModel(request.model, 'agent', defaults);

    let conversationId = request.conversationId;
    if (!conversationId) {
      const firstUser = request.messages.find((m) => m.role === 'user');
      const conversation = await this.prisma.conversation.create({
        data: {
          userId,
          title: this.generateTitle(firstUser?.content || 'Agent task'),
          model,
        },
      });
      conversationId = conversation.id;
    }

    const images = Array.isArray(request.context?.images)
      ? (request.context.images as Array<{ mediaType: string; data: string }>)
      : undefined;

    const isFirstTurn = request.messages.filter((m) => m.role === 'user').length <= 1;
    let screenshotAnalysis: string | undefined =
      typeof request.context?.screenshotAnalysis === 'string'
        ? request.context.screenshotAnalysis
        : undefined;

    if (images?.length && isFirstTurn && !screenshotAnalysis) {
      try {
        const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
        const scan = await this.multiModel.analyzeScreenshot(images, lastUser?.content || undefined);
        screenshotAnalysis = scan.analysis;
        await this.logUsage(userId, 'agent', scan.tokens, this.calculateCost(scan.model, scan.tokens), scan.model);
      } catch (err) {
        console.warn('Screenshot pre-analysis failed:', err);
      }
    }

    const agentMode =
      typeof request.context?.agentMode === 'string' ? request.context.agentMode : undefined;

    let systemPrompt = getAgentSystemPrompt({
      ...request.context,
      hasScreenshots: !!images?.length,
      screenshotAnalysis,
      agentMode,
    });

    if (request.context?.repositoryPath && this.repoService.isConfigured()) {
      try {
        const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
        if (lastUser?.content) {
          const { results } = await this.repoService.searchContext(userId, lastUser.content, 5);
          if (results.length) {
            const ctx = results.map((r) => `File: ${r.path}\n${r.content}`).join('\n---\n');
            systemPrompt += `\n\nRelevant codebase context:\n${ctx}`;
          }
        }
      } catch { /* optional */ }
    }

    try {
      const result = await this.multiModel.agentStepWithTools(
        request.model,
        systemPrompt,
        request.messages,
        AGENT_TOOLS,
        images,
        agentMode,
      );

      const usedModel = result.model;
      const tokens = result.tokens;
      const cost = this.calculateCost(usedModel, tokens);

      const finishReason =
        result.finishReason === 'tool_calls' || result.toolCalls?.length
          ? 'tool_calls'
          : 'stop';

      const responseMessage: AgentMessage = {
        role: 'assistant',
        content: result.content,
      };

      if (result.toolCalls?.length) {
        responseMessage.tool_calls = result.toolCalls;
      }

      const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user');
      if (lastUserMsg?.content && !request.conversationId) {
        await this.prisma.message.create({
          data: {
            conversationId,
            role: 'USER',
            content: lastUserMsg.content,
            metadata: request.context,
          },
        });
      }

      if (finishReason === 'stop' && result.content) {
        await this.prisma.message.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: result.content,
            tokens,
          },
        });
      }

      await this.logUsage(userId, 'agent', tokens, cost, `${result.provider}:${usedModel}`);

      return {
        conversationId,
        message: responseMessage,
        finishReason,
        tokens,
        cost,
        provider: result.provider,
        model: usedModel,
        screenshotAnalysis,
      };
    } catch (error) {
      throw new BadRequestException(formatOpenAIError(error));
    }
  }

  async analyzeScreenshot(
    userId: string,
    images: Array<{ mediaType: string; data: string }>,
    prompt?: string,
  ): Promise<{ analysis: string; provider: string; model: string }> {
    await this.rateLimit.checkAiRateLimit(userId);
    await this.checkUserQuota(userId);

    const scan = await this.multiModel.analyzeScreenshot(images, prompt);
    await this.logUsage(userId, 'agent', scan.tokens, this.calculateCost(scan.model, scan.tokens), scan.model);
    return { analysis: scan.analysis, provider: scan.provider, model: scan.model };
  }

  async composer(userId: string, request: ComposerRequest): Promise<any> {
    // Check user quota
    await this.checkUserQuota(userId);

    const defaults = this.getDefaultModels();
    const model = resolveOpenAIModel(request.model, 'agent', defaults);

    const prompt = this.buildComposerPrompt(request);

    try {
      const completion = await this.createCompletion(
        model,
        [
          {
            role: 'system',
            content:
              'You are an AI coding assistant that can modify multiple files. Return your response as JSON with file paths and their new content.',
          },
          { role: 'user', content: prompt },
        ],
        4000,
        0.3,
      );
      const usedModel = completion.model || model;
      const response = completion.choices[0]?.message?.content || '';
      const tokens = completion.usage?.total_tokens || 0;
      const cost = this.calculateCost(usedModel, tokens);

      // Log usage
      await this.logUsage(userId, 'composer', tokens, cost, usedModel);

      // Parse JSON response (strip markdown fences if present)
      try {
        const cleaned = response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        const changes = this.normalizeComposerChanges(parsed, request.files);
        return { changes };
      } catch {
        throw new BadRequestException('Invalid AI response format');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(formatOpenAIError(error));
    }
  }

  async checkUserQuota(userId: string): Promise<void> {
    const subscription = await this.usersService.getUserSubscription(userId);
    if (!subscription) {
      throw new BadRequestException('No active subscription found');
    }

    // Check daily quota (simplified)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limits = (subscription.plan.limits as Record<string, number>) || {};
    const dailyLimit = limits.dailyRequests || 20;

    const dailyRequests = await this.prisma.usageLog.count({
      where: { userId, createdAt: { gte: today } },
    });

    if (dailyRequests >= dailyLimit) {
      throw new BadRequestException('Daily quota exceeded. Upgrade your plan or purchase extra credits.');
    }
  }

  private async logUsage(userId: string, type: string, tokens: number, cost: number, model: string): Promise<void> {
    await this.prisma.usageLog.create({
      data: {
        userId,
        type,
        tokensUsed: tokens,
        cost,
        model,
      },
    });
  }

  private getSystemPrompt(context?: ChatRequest['context']): string {
    let prompt = `You are Xander AI, an expert coding assistant in Xander AI IDE. You help developers write, debug, and understand code. You can answer questions about the user's open workspace and files.`;

    if (context?.workspaceFolders?.length) {
      prompt += `\nWorkspace folders:\n${context.workspaceFolders.map((f) => `- ${f}`).join('\n')}`;
    }

    if (context?.repositoryPath) {
      prompt += `\nPrimary project folder: ${context.repositoryPath}`;
    }

    if (context?.currentFile) {
      prompt += `\nCurrent file: ${context.currentFile}`;
    }

    if (context?.currentFileContent) {
      prompt += `\n\nCurrent file content (truncated):\n${context.currentFileContent}`;
    }

    if (context?.projectTree) {
      prompt += `\n\nProject structure:\n${context.projectTree}`;
    }

    if (context?.openFiles?.length) {
      prompt += `\nOpen files: ${context.openFiles.join(', ')}`;
    }

    if (context?.directoryListing) {
      prompt += `\n\nDirectory listing from the user's machine:\n${context.directoryListing}`;
    }

    if (context?.selectedText) {
      prompt += `\nSelected text:\n${context.selectedText}`;
    }

    if (context?.semanticContext) {
      prompt += `\n\nSemantically relevant code from indexed codebase:\n${context.semanticContext}`;
    }

    prompt += `\n\nProvide helpful, accurate, and concise responses. When listing files, use the directory listing above when available.`;

    if (context?.repositoryPath) {
      prompt += ACTION_AWARE_PROMPT;
    }

    return prompt;
  }

  private buildAutocompletePrompt(request: AutocompleteRequest): string {
    return `Complete the following code in ${request.language} file "${request.filename}":

\`\`\`${request.language}
${request.prefix}[CURSOR]${request.suffix}
\`\`\`

Provide only the completion text without explanations.`;
  }

  private normalizeComposerChanges(
    parsed: unknown,
    sourceFiles: ComposerRequest['files'],
  ): Array<{ path: string; content: string; originalContent: string }> {
    const entries: Array<{ path: string; content: string }> = [];

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object' && 'path' in item && 'content' in item) {
          entries.push({ path: String((item as { path: string }).path), content: String((item as { content: string }).content) });
        }
      }
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.changes)) return this.normalizeComposerChanges(obj.changes, sourceFiles);
      if (Array.isArray(obj.files)) return this.normalizeComposerChanges(obj.files, sourceFiles);
      for (const [path, content] of Object.entries(obj)) {
        if (path === 'changes' || path === 'files') continue;
        if (typeof content === 'string') entries.push({ path, content });
      }
    }

    return entries.map(({ path, content }) => {
      const normalized = path.replace(/\\/g, '/');
      const original =
        sourceFiles.find(
          (f) =>
            f.path.replace(/\\/g, '/') === normalized ||
            f.path.replace(/\\/g, '/').endsWith(normalized),
        )?.content ?? '';
      return { path, content, originalContent: original };
    });
  }

  private buildComposerPrompt(request: ComposerRequest): string {
    let prompt = `Instruction: ${request.instruction}\n\nFiles to modify:\n`;

    request.files.forEach((file, index) => {
      prompt += `\n${index + 1}. ${file.path}:\n\`\`\`\n${file.content}\n\`\`\`\n`;
    });

    prompt += `\n\nProvide the modified files as JSON with file paths as keys and new content as values.`;

    return prompt;
  }

  private generateTitle(message: string): string {
    const firstLine = message.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  }

  private calculateCost(model: string, tokens: number): number {
    return this.multiModel.calculateCost(model, tokens);
  }

  async checkQuotaStatus(userId: string): Promise<{ used: number; limit: number; warning?: boolean; warningMessage?: string }> {
    const subscription = await this.usersService.getUserSubscription(userId);
    const limits = (subscription?.plan?.limits as Record<string, number>) || {};
    const dailyLimit = limits.dailyRequests || 20;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailyRequests = await this.prisma.usageLog.count({
      where: { userId, createdAt: { gte: today } },
    });

    const remaining = dailyLimit - dailyRequests;
    const warning = remaining <= 5;

    return {
      used: dailyRequests,
      limit: dailyLimit,
      warning,
      warningMessage: warning
        ? `Low quota: ${remaining} requests remaining today. Consider upgrading your plan.`
        : undefined,
    };
  }

  async logUsageDirect(userId: string, type: string, tokens: number, cost: number, model: string): Promise<void> {
    await this.logUsage(userId, type, tokens, cost, model);
  }

  async *streamChat(userId: string, request: ChatRequest): AsyncGenerator<StreamEvent> {
    await this.rateLimit.checkAiRateLimit(userId);
    await this.checkUserQuota(userId);

    const defaults = this.getDefaultModels();
    const model = resolveOpenAIModel(request.model, 'agent', defaults);

    yield { type: 'step', step: 'thinking', message: 'Analyzing your request...' };

    let conversationId = request.conversationId;
    if (!conversationId) {
      const conversation = await this.prisma.conversation.create({
        data: { userId, title: this.generateTitle(request.message), model },
      });
      conversationId = conversation.id;
    }

    await this.prisma.message.create({
      data: { conversationId, role: 'USER', content: request.message, metadata: request.context },
    });

    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const llmMessages = messages.map((msg) => ({
      role: msg.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));
    llmMessages.unshift({ role: 'system', content: this.getSystemPrompt(request.context) });

    let fullContent = '';
    let totalTokens = 0;
    let usedModel = model;

    const stream = this.multiModel.streamComplete(request.model, 'chat', {
      messages: llmMessages,
      maxTokens: request.maxTokens || 8000,
      temperature: request.temperature || 0.7,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'text_delta' && chunk.delta) {
        fullContent += chunk.delta;
        yield { type: 'text_delta', delta: chunk.delta };
      } else if (chunk.type === 'done') {
        totalTokens = chunk.tokens || 0;
        usedModel = chunk.model || model;
      }
    }

    const actions = parseActionsFromText(fullContent);
    for (const action of actions) {
      yield { type: 'action', action: { type: action.type, path: action.path, content: action.content, command: action.command } };
    }

    const displayContent = fullContent.replace(/```(?:json)?\s*[\s\S]*?```/gi, '').trim() || fullContent;

    await this.prisma.message.create({
      data: { conversationId, role: 'ASSISTANT', content: displayContent, tokens: totalTokens },
    });

    const cost = this.calculateCost(usedModel, totalTokens);
    await this.logUsage(userId, 'chat', totalTokens, cost, usedModel);

    yield {
      type: 'task_complete',
      summary: { tokens: totalTokens, cost },
    };
  }
}
