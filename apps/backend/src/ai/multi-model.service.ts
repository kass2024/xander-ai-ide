import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { normalizeOpenAIKey, resolveOpenAIModel, getModelFallbacks, resolveGeminiModel, getGeminiFallbacks } from './model.utils';
import { AGENT_TOOLS } from './agent.tools';
import { isUiRelatedTask, extractLastUserText } from './ui-routing.utils';
import { routeProviderForMode, normalizeAgentMode } from './agent-modes';

export type TaskType =
  | 'autocomplete'
  | 'chat'
  | 'agent'
  | 'composer'
  | 'project_builder'
  | 'code_review'
  | 'repo_analysis'
  | 'embedding';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  toolChoice?: 'auto' | 'none';
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  provider: string;
  tokens: number;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  finishReason?: string;
}

export interface StreamChunk {
  type: 'text_delta' | 'tool_call_delta' | 'done';
  delta?: string;
  toolCall?: { id: string; name: string; arguments: string };
  tokens?: number;
  model?: string;
}

@Injectable()
export class MultiModelService implements OnModuleInit {
  private readonly logger = new Logger(MultiModelService.name);
  private openai: OpenAI | null = null;
  private anthropicKey: string | null = null;
  private geminiKey: string | null = null;

  constructor(private config: ConfigService) {
    const openaiKey = normalizeOpenAIKey(config.get<string>('OPENAI_API_KEY'));
    if (openaiKey) this.openai = new OpenAI({ apiKey: openaiKey });
    this.anthropicKey = config.get<string>('ANTHROPIC_API_KEY') || null;
    this.geminiKey = config.get<string>('GEMINI_API_KEY') || config.get<string>('GOOGLE_AI_API_KEY') || null;
  }

  onModuleInit() {
    const s = this.getProvidersStatus();
    const m = this.getDefaultModels();
    this.logger.log(
      `AI providers — OpenAI: ${s.openai ? m.agent : 'off'} | Claude: ${s.anthropic ? m.claude : 'off'} | Gemini: ${s.google ? m.gemini : 'off'}`,
    );
  }

  getProvidersStatus() {
    return {
      openai: !!this.openai,
      anthropic: !!this.anthropicKey,
      google: !!this.geminiKey,
    };
  }

  getDefaultModels() {
    return {
      agent: resolveOpenAIModel(this.config.get('OPENAI_MODEL_AGENT'), 'agent', {
        agent: 'gpt-4o',
        fast: 'gpt-4o-mini',
      }),
      fast: resolveOpenAIModel(this.config.get('OPENAI_MODEL_FAST'), 'fast', {
        agent: 'gpt-4o',
        fast: 'gpt-4o-mini',
      }),
      claude: this.config.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-20250514',
      gemini: resolveGeminiModel(
        undefined,
        this.config.get('GEMINI_MODEL') || this.config.get('GOOGLE_AI_MODEL') || 'gemini-2.5-flash',
      ),
      embedding: this.config.get('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small',
    };
  }

  routeModel(
    requested: string | undefined,
    task: TaskType,
    agentMode?: string,
    prompt?: string,
  ): { provider: string; model: string } {
    const defaults = this.getDefaultModels();
    const uiTask = isUiRelatedTask(prompt || '');

    if (requested && requested !== 'auto') {
      if (requested.startsWith('claude') || requested.includes('anthropic')) {
        return { provider: 'anthropic', model: requested };
      }
      if (requested.startsWith('gemini')) {
        return { provider: 'google', model: resolveGeminiModel(requested, defaults.gemini) };
      }
      return { provider: 'openai', model: resolveOpenAIModel(requested, 'agent', defaults) };
    }

    // AutoRouter by agent task mode (chat | plan | build | debug | refactor | database | command)
    if (task === 'agent' && agentMode) {
      const mode = normalizeAgentMode(agentMode);
      const routed = routeProviderForMode(mode, uiTask, {
        openai: !!this.openai,
        anthropic: !!this.anthropicKey,
        gemini: !!this.geminiKey,
      });
      if (routed === 'anthropic' && this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
      if (routed === 'google' && this.geminiKey) return { provider: 'google', model: defaults.gemini };
      if (routed === 'openai' && this.openai) {
        return { provider: 'openai', model: mode === 'chat' || mode === 'command' ? defaults.fast : defaults.agent };
      }
      if (this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
      if (this.openai) return { provider: 'openai', model: defaults.agent };
      if (this.geminiKey) return { provider: 'google', model: defaults.gemini };
    }

    switch (task) {
      case 'autocomplete':
        return { provider: 'openai', model: defaults.fast };
      case 'chat':
        if (uiTask && this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
        if (this.openai) return { provider: 'openai', model: defaults.fast };
        if (this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
        return { provider: 'openai', model: defaults.fast };
      case 'code_review':
        if (this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
        return { provider: 'openai', model: defaults.agent };
      case 'repo_analysis':
        if (this.geminiKey) return { provider: 'google', model: defaults.gemini };
        return { provider: 'openai', model: defaults.agent };
      case 'agent':
        if (uiTask && this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
        if (this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
        if (this.openai) return { provider: 'openai', model: defaults.agent };
        if (this.geminiKey) return { provider: 'google', model: defaults.gemini };
        return { provider: 'openai', model: defaults.agent };
      case 'composer':
      case 'project_builder':
        if (this.anthropicKey) return { provider: 'anthropic', model: defaults.claude };
        if (this.geminiKey) return { provider: 'google', model: defaults.gemini };
        return { provider: 'openai', model: defaults.agent };
      default:
        return { provider: 'openai', model: defaults.agent };
    }
  }

  /** Agent step with tool calling — prefers Claude for coding accuracy. */
  async agentStepWithTools(
    requested: string | undefined,
    systemPrompt: string,
    messages: Array<{ role: string; content?: string | null; tool_call_id?: string; tool_calls?: LLMCompletionResult['toolCalls'] }>,
    tools = AGENT_TOOLS,
    images?: Array<{ mediaType: string; data: string }>,
    agentMode?: string,
  ): Promise<LLMCompletionResult> {
    const prompt = extractLastUserText(messages);
    const { provider, model } = this.routeModel(requested, 'agent', agentMode, prompt);
    const fallbacks = this.getFallbackChain(provider, model);

    let lastError: unknown;
    for (const { prov, mod } of fallbacks) {
      try {
        if (prov === 'anthropic' && this.anthropicKey) {
          return await this.callAnthropicAgent(mod, systemPrompt, messages, tools, images);
        }
        if (prov === 'openai' && this.openai) {
          return await this.callOpenAIAgent(mod, systemPrompt, messages, tools, images);
        }
        if (prov === 'google' && this.geminiKey) {
          return await this.callGeminiAgent(mod, systemPrompt, messages);
        }
      } catch (err) {
        lastError = err;
        console.warn(`Agent step failed ${prov}/${mod}:`, err);
      }
    }
    throw lastError || new Error('No AI provider available for agent');
  }

  async complete(requested: string | undefined, task: TaskType, options: LLMCompletionOptions, agentMode?: string): Promise<LLMCompletionResult> {
    const prompt = extractLastUserText(options.messages);
    const { provider, model } = this.routeModel(requested, task, agentMode, prompt);
    const fallbacks = this.getFallbackChain(provider, model);

    let lastError: unknown;
    for (const { prov, mod } of fallbacks) {
      try {
        return await this.callProvider(prov, mod, options);
      } catch (err) {
        lastError = err;
        console.warn(`LLM call failed for ${prov}/${mod}:`, err);
      }
    }
    throw lastError;
  }

  async *streamComplete(requested: string | undefined, task: TaskType, options: LLMCompletionOptions, agentMode?: string): AsyncGenerator<StreamChunk> {
    const prompt = extractLastUserText(options.messages);
    const { provider, model } = this.routeModel(requested, task, agentMode, prompt);

    if (provider === 'openai' && this.openai) {
      yield* this.streamOpenAI(model, options);
      return;
    }

    const result = await this.complete(requested, task, { ...options, stream: false });
    if (result.content) {
      const chunkSize = 40;
      for (let i = 0; i < result.content.length; i += chunkSize) {
        yield { type: 'text_delta', delta: result.content.slice(i, i + chunkSize), model: result.model };
        await new Promise((r) => setTimeout(r, 3));
      }
    }
    yield { type: 'done', tokens: result.tokens, model: result.model };
  }

  private getFallbackChain(primaryProvider: string, primaryModel: string): Array<{ prov: string; mod: string }> {
    const chain: Array<{ prov: string; mod: string }> = [];
    const defaults = this.getDefaultModels();
    const seen = new Set<string>();

    const push = (prov: string, mod: string) => {
      const key = `${prov}:${mod}`;
      if (seen.has(key)) return;
      seen.add(key);
      chain.push({ prov, mod });
    };

    if (primaryProvider === 'google' && this.geminiKey) {
      for (const mod of getGeminiFallbacks(primaryModel)) push('google', mod);
    } else {
      push(primaryProvider, primaryModel);
    }

    if (primaryProvider !== 'anthropic' && this.anthropicKey) push('anthropic', defaults.claude);
    if (primaryProvider !== 'openai' && this.openai) {
      for (const mod of getModelFallbacks(defaults.agent)) push('openai', mod);
    }
    if (primaryProvider !== 'google' && this.geminiKey) {
      for (const mod of getGeminiFallbacks(defaults.gemini)) push('google', mod);
    }
    return chain;
  }

  private async callProvider(provider: string, model: string, options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    switch (provider) {
      case 'anthropic': return this.callAnthropic(model, options);
      case 'google': return this.callGemini(model, options);
      default: return this.callOpenAI(model, options);
    }
  }

  private anthropicTools(tools: OpenAI.Chat.Completions.ChatCompletionTool[]) {
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description || '',
      input_schema: t.function.parameters as Record<string, unknown>,
    }));
  }

  private async callAnthropicAgent(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content?: string | null; tool_call_id?: string; tool_calls?: LLMCompletionResult['toolCalls'] }>,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    images?: Array<{ mediaType: string; data: string }>,
  ): Promise<LLMCompletionResult> {
    const anthropicMessages: Array<Record<string, unknown>> = [];
    let imagesInjected = false;

    for (const m of messages) {
      if (m.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content || '' }],
        });
      } else if (m.role === 'assistant' && m.tool_calls?.length) {
        const content: Array<Record<string, unknown>> = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of m.tool_calls) {
          let input = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }
          content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
        anthropicMessages.push({ role: 'assistant', content });
      } else if (m.role === 'user' || m.role === 'assistant') {
        if (m.role === 'user' && !imagesInjected && images?.length) {
          imagesInjected = true;
          const content: Array<Record<string, unknown>> = [
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.data },
            })),
            {
              type: 'text',
              text: m.content || 'Analyze the attached screenshot(s) and help with the coding task.',
            },
          ];
          anthropicMessages.push({ role: 'user', content });
        } else {
          anthropicMessages.push({ role: m.role, content: m.content || '' });
        }
      }
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        system: systemPrompt,
        tools: this.anthropicTools(tools),
        messages: anthropicMessages,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };

    let textContent = '';
    const toolCalls: LLMCompletionResult['toolCalls'] = [];

    for (const block of data.content || []) {
      if (block.type === 'text' && block.text) textContent += block.text;
      if (block.type === 'tool_use' && block.id && block.name) {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: JSON.stringify(block.input || {}) },
        });
      }
    }

    return {
      content: textContent,
      model,
      provider: 'anthropic',
      tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      toolCalls: toolCalls.length ? toolCalls : undefined,
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }

  private async callOpenAIAgent(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content?: string | null; tool_call_id?: string; tool_calls?: LLMCompletionResult['toolCalls'] }>,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    images?: Array<{ mediaType: string; data: string }>,
  ): Promise<LLMCompletionResult> {
    let imagesInjected = false;
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.filter((m) => m.role !== 'system').map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool' as const, tool_call_id: m.tool_call_id!, content: m.content || '' };
        }
        if (m.role === 'assistant' && m.tool_calls?.length) {
          return {
            role: 'assistant' as const,
            content: m.content,
            tool_calls: m.tool_calls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          };
        }
        if (m.role === 'user' && !imagesInjected && images?.length) {
          imagesInjected = true;
          return {
            role: 'user' as const,
            content: [
              ...images.map((img) => ({
                type: 'image_url' as const,
                image_url: { url: `data:${img.mediaType};base64,${img.data}` },
              })),
              { type: 'text' as const, text: m.content || 'Analyze the attached screenshot(s).' },
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content || '' };
      }),
    ];

    const completion = await this.openai!.chat.completions.create({
      model,
      messages: openaiMessages,
      tools,
      tool_choice: 'auto',
      max_tokens: 16000,
      temperature: 0.2,
    });

    const msg = completion.choices[0]?.message;
    return {
      content: msg?.content || '',
      model: completion.model || model,
      provider: 'openai',
      tokens: completion.usage?.total_tokens || 0,
      toolCalls: msg?.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
      finishReason: completion.choices[0]?.finish_reason || undefined,
    };
  }

  private async callGeminiAgent(
    model: string,
    systemPrompt: string,
    messages: Array<{ role: string; content?: string | null }>,
  ): Promise<LLMCompletionResult> {
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');
    const prompt = `${systemPrompt}\n\n${conversation}\n\nRespond with actions using read_file/write_file tools described in the system prompt. If you need to edit files, describe the exact file path and full new content.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 16000, temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Gemini API error ${res.status}: ${detail}`);
    }
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { content: text, model, provider: 'google', tokens: Math.ceil(text.length / 4) };
  }

  private async callOpenAI(model: string, options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    if (!this.openai) throw new Error('OpenAI not configured');
    const messages = options.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));
    const completion = await this.openai.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 16000,
      temperature: options.temperature ?? 0.7,
      stream: false,
    });
    const msg = completion.choices[0]?.message;
    return {
      content: msg?.content || '',
      model: completion.model || model,
      provider: 'openai',
      tokens: completion.usage?.total_tokens || 0,
    };
  }

  private async *streamOpenAI(model: string, options: LLMCompletionOptions): AsyncGenerator<StreamChunk> {
    if (!this.openai) throw new Error('OpenAI not configured');
    const messages = options.messages.map((m) => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: m.content,
    }));
    const stream = await this.openai.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 16000,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });
    let tokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        tokens += Math.ceil(delta.length / 4);
        yield { type: 'text_delta', delta, model: chunk.model || model };
      }
    }
    yield { type: 'done', tokens, model };
  }

  private async callAnthropic(model: string, options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const systemMsg = options.messages.find((m) => m.role === 'system')?.content || '';
    const userMessages = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens || 16000,
        system: systemMsg,
        messages: userMessages,
      }),
    });

    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = await res.json() as {
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = data.content?.find((b) => b.type === 'text')?.text || '';
    return {
      content: text,
      model,
      provider: 'anthropic',
      tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  private async callGemini(model: string, options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const systemMsg = options.messages.find((m) => m.role === 'system')?.content || '';
    const conversation = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');
    const prompt = systemMsg ? `${systemMsg}\n\n${conversation}` : conversation;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: options.maxTokens || 16000, temperature: options.temperature ?? 0.3 },
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Gemini API error ${res.status}: ${detail}`);
    }
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { content: text, model, provider: 'google', tokens: Math.ceil(text.length / 4) };
  }

  /** Vision-only scan of screenshot(s) — extracts errors, HTTP codes, stack traces. */
  async analyzeScreenshot(
    images: Array<{ mediaType: string; data: string }>,
    userPrompt?: string,
  ): Promise<{ analysis: string; provider: string; model: string; tokens: number }> {
    const systemPrompt = `You are an expert at reading software error screenshots and browser windows.
Extract ALL visible technical information with exact quotes when readable:
- HTTP status pages (404 Not Found, 500 Internal Server Error, etc.) and URLs
- PHP/Python/JavaScript/Node/SQL error messages, warnings, and notices
- Stack traces with file paths and line numbers
- Browser devtools console errors
- Login/auth failures, database connection errors, missing file errors
- Visible UI bugs or broken layout clues

Format as a concise structured report:
## Visible errors
(quote exact text)
## URL / page context
## Likely root cause
## Suggested files to inspect first

If no error is visible, describe what the screenshot shows and what the user likely wants fixed.`;

    const userText = userPrompt?.trim()
      ? `User request: ${userPrompt}\n\nAnalyze the attached screenshot(s) and report every error or issue visible.`
      : 'Analyze the attached screenshot(s) and report every error or issue visible.';

    const defaults = this.getDefaultModels();
    const primaryProv = this.anthropicKey ? 'anthropic' : this.openai ? 'openai' : 'google';
    const primaryMod = this.anthropicKey
      ? defaults.claude
      : this.openai
        ? defaults.agent
        : defaults.gemini;
    const fallbacks = this.getFallbackChain(primaryProv, primaryMod);

    let lastError: unknown;
    for (const { prov, mod } of fallbacks) {
      try {
        if (prov === 'anthropic' && this.anthropicKey) {
          const content: Array<Record<string, unknown>> = [
            ...images.map((img) => ({
              type: 'image',
              source: { type: 'base64', media_type: img.mediaType, data: img.data },
            })),
            { type: 'text', text: userText },
          ];
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: mod,
              max_tokens: 4096,
              system: systemPrompt,
              messages: [{ role: 'user', content }],
            }),
          });
          if (!res.ok) throw new Error(`Claude vision ${res.status}: ${(await res.text()).slice(0, 200)}`);
          const data = await res.json() as {
            content?: Array<{ type: string; text?: string }>;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          const analysis = data.content?.find((b) => b.type === 'text')?.text?.trim() || '';
          const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
          return { analysis, provider: 'anthropic', model: mod, tokens };
        }
        if (prov === 'openai' && this.openai) {
          const completion = await this.openai.chat.completions.create({
            model: mod.includes('gpt-4') ? mod : 'gpt-4o',
            max_tokens: 4096,
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  ...images.map((img) => ({
                    type: 'image_url' as const,
                    image_url: { url: `data:${img.mediaType};base64,${img.data}` },
                  })),
                  { type: 'text' as const, text: userText },
                ],
              },
            ],
          });
          const analysis = completion.choices[0]?.message?.content?.trim() || '';
          const tokens = completion.usage?.total_tokens || 0;
          return { analysis, provider: 'openai', model: completion.model, tokens };
        }
      } catch (err) {
        lastError = err;
        console.warn(`Screenshot analysis failed ${prov}/${mod}:`, err);
      }
    }
    throw lastError || new Error('No vision provider available for screenshot analysis');
  }

  calculateCost(model: string, tokens: number): number {
    const costs: Record<string, number> = {
      'gpt-4o': 0.000005,
      'gpt-4o-mini': 0.0000005,
      'claude-sonnet-4-20250514': 0.000015,
      'gemini-2.5-flash': 0.000001,
      'gemini-2.5-pro': 0.000005,
      'gemini-2.0-flash': 0.000001,
    };
    return (costs[model] || 0.00001) * tokens;
  }
}
