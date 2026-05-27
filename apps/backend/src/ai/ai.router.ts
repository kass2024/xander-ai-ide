import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

export interface AIRequest {
  prompt: string;
  context?: string;
  language?: string;
  type?: 'autocomplete' | 'generate' | 'explain' | 'debug' | 'optimize';
  position?: { line: number; column: number };
}

export interface AIResponse {
  content: string;
  type: 'code' | 'explanation' | 'error' | 'suggestion';
  model: string;
  tokensUsed: number;
  cost: number;
}

@Injectable()
export class AIRouter {
  private openai: OpenAI;
  private models: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
    this.models = {
      main: this.configService.get<string>('OPENAI_MODEL_AGENT') || 'gpt-4.1',
      mini: this.configService.get<string>('OPENAI_MODEL_FAST') || 'gpt-4.1-mini',
      fast: 'gpt-3.5-turbo',
      embedding: this.configService.get<string>('OPENAI_EMBEDDING_MODEL') || 'text-embedding-3-small',
    };
  }

  async routeRequest(request: AIRequest): Promise<AIResponse> {
    const model = this.selectModel(request);
    
    try {
      switch (model) {
        case 'main':
          return await this.handleMainModel(request);
        case 'mini':
          return await this.handleMiniModel(request);
        case 'fast':
          return await this.handleFastModel(request);
        default:
          return await this.handleMainModel(request);
      }
    } catch (error) {
      console.error('AI request failed:', error);
      // Fallback to fast model
      return await this.handleFastModel(request);
    }
  }

  private selectModel(request: AIRequest): string {
    const { type, prompt, language } = request;

    // Route based on task type and complexity
    switch (type) {
      case 'autocomplete':
        return 'mini'; // Fast and cheap for autocomplete
        
      case 'generate':
      case 'debug':
      case 'optimize':
        return 'main';

      case 'explain':
        return prompt.length > 500 ? 'main' : 'mini';

      default:
        if (prompt.length < 100) return 'mini';
        if (prompt.length > 2000) return 'main';
        return 'mini';
    }
  }

  private async handleMainModel(request: AIRequest): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt(request);
    
    const completion = await this.openai.chat.completions.create({
      model: this.models.main,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.prompt }
      ],
      max_tokens: this.getMaxTokens(request.type),
      temperature: this.getTemperature(request.type),
    });

    return {
      content: completion.choices[0].message.content || '',
      type: this.getResponseType(request.type),
      model: this.models.main,
      tokensUsed: completion.usage?.total_tokens || 0,
      cost: this.calculateCost(completion.usage?.total_tokens || 0, this.models.main)
    };
  }

  private async handleMiniModel(request: AIRequest): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt(request);
    
    const completion = await this.openai.chat.completions.create({
      model: this.models.mini,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.prompt }
      ],
      max_tokens: 500, // Smaller for mini model
      temperature: 0.3, // Lower temperature for consistency
    });

    return {
      content: completion.choices[0].message.content || '',
      type: this.getResponseType(request.type),
      model: this.models.mini,
      tokensUsed: completion.usage?.total_tokens || 0,
      cost: this.calculateCost(completion.usage?.total_tokens || 0, this.models.mini)
    };
  }

  private async handleFastModel(request: AIRequest): Promise<AIResponse> {
    const systemPrompt = this.buildSystemPrompt(request);
    
    const completion = await this.openai.chat.completions.create({
      model: this.models.fast,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.prompt }
      ],
      max_tokens: 300,
      temperature: 0.2,
    });

    return {
      content: completion.choices[0].message.content || '',
      type: this.getResponseType(request.type),
      model: this.models.fast,
      tokensUsed: completion.usage?.total_tokens || 0,
      cost: this.calculateCost(completion.usage?.total_tokens || 0, this.models.fast)
    };
  }

  private async handleClaudeModel(request: AIRequest): Promise<AIResponse> {
    // Simulate Claude response (would integrate with Anthropic API)
    const mockResponse = {
      content: `[Claude Sonnet Response] Advanced reasoning for: ${request.prompt.substring(0, 100)}...`,
      type: 'explanation' as const,
      model: this.models.claude,
      tokensUsed: Math.floor(request.prompt.length / 4),
      cost: 0.015
    };

    return mockResponse;
  }

  private async handleGeminiModel(request: AIRequest): Promise<AIResponse> {
    // Simulate Gemini response (would integrate with Google AI API)
    const mockResponse = {
      content: `[Gemini Flash Response] Ultra-fast response for: ${request.prompt.substring(0, 100)}...`,
      type: 'suggestion' as const,
      model: this.models.gemini,
      tokensUsed: Math.floor(request.prompt.length / 4),
      cost: 0.001
    };

    return mockResponse;
  }

  private buildSystemPrompt(request: AIRequest): string {
    const { type, language, context } = request;
    
    let basePrompt = 'You are Xander Assistant, the AI coding assistant for Xander AI IDE. ';
    
    switch (type) {
      case 'autocomplete':
        basePrompt += 'Provide concise code completions. Return only the code, no explanations.';
        break;
      case 'generate':
        basePrompt += 'Generate high-quality, production-ready code. Include comments for complex logic.';
        break;
      case 'explain':
        basePrompt += 'Explain code clearly and concisely. Focus on the key concepts and patterns.';
        break;
      case 'debug':
        basePrompt += 'Identify bugs and provide specific fixes. Explain the root cause and solution.';
        break;
      case 'optimize':
        basePrompt += 'Suggest performance optimizations. Explain the benefits and any trade-offs.';
        break;
      default:
        basePrompt += 'Provide helpful coding assistance.';
    }

    if (language) {
      basePrompt += ` The code is in ${language}.`;
    }

    if (context) {
      basePrompt += `\n\nContext:\n${context}`;
    }

    return basePrompt;
  }

  private getMaxTokens(type?: string): number {
    switch (type) {
      case 'autocomplete': return 100;
      case 'generate': return 2000;
      case 'explain': return 1000;
      case 'debug': return 1500;
      case 'optimize': return 1500;
      default: return 1000;
    }
  }

  private getTemperature(type?: string): number {
    switch (type) {
      case 'autocomplete': return 0.1;
      case 'generate': return 0.7;
      case 'explain': return 0.5;
      case 'debug': return 0.3;
      case 'optimize': return 0.4;
      default: return 0.5;
    }
  }

  private getResponseType(type?: string): 'code' | 'explanation' | 'error' | 'suggestion' {
    switch (type) {
      case 'autocomplete':
      case 'generate':
        return 'code';
      case 'explain':
        return 'explanation';
      case 'debug':
        return 'suggestion';
      case 'optimize':
        return 'suggestion';
      default:
        return 'explanation';
    }
  }

  private calculateCost(tokens: number, model: string): number {
    // Cost per 1K tokens (approximate)
    const costs = {
      [this.models.main]: 0.03,
      [this.models.mini]: 0.001,
      [this.models.fast]: 0.002,
      [this.models.claude]: 0.015,
      [this.models.gemini]: 0.001,
    };

    return (tokens / 1000) * (costs[model] || 0.01);
  }

  // Health check for AI services
  async checkHealth(): Promise<{ status: string; models: string[] }> {
    const availableModels = [];
    
    try {
      // Test main model
      await this.openai.models.retrieve(this.models.main);
      availableModels.push(this.models.main);
    } catch (error) {
      console.error('Main model unavailable:', error);
    }

    try {
      // Test mini model
      await this.openai.models.retrieve(this.models.mini);
      availableModels.push(this.models.mini);
    } catch (error) {
      console.error('Mini model unavailable:', error);
    }

    return {
      status: availableModels.length > 0 ? 'healthy' : 'unhealthy',
      models: availableModels
    };
  }
}
