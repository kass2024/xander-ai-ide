import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { normalizeOpenAIKey } from './model.utils';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'groq' | 'mistral' | 'ollama';

export interface ProviderConfig {
  provider: LLMProvider;
  client: OpenAI;
  defaultModel: string;
}

/**
 * Returns an OpenAI-compatible client for the requested provider.
 * Anthropic/Google need separate SDKs for full support — use OpenAI-compatible
 * gateways (DeepSeek, Groq, Ollama) or set provider-specific env vars.
 */
export function createLLMClient(config: ConfigService, preferred?: LLMProvider): ProviderConfig {
  const provider = preferred || detectProvider(config);

  switch (provider) {
    case 'deepseek': {
      const key = config.get<string>('DEEPSEEK_API_KEY');
      const base = config.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
      return {
        provider: 'deepseek',
        client: new OpenAI({ apiKey: key || 'unused', baseURL: base }),
        defaultModel: config.get<string>('DEEPSEEK_MODEL') || 'deepseek-chat',
      };
    }
    case 'groq': {
      const key = config.get<string>('GROQ_API_KEY');
      const base = config.get<string>('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1';
      return {
        provider: 'groq',
        client: new OpenAI({ apiKey: key || 'unused', baseURL: base }),
        defaultModel: config.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile',
      };
    }
    case 'ollama': {
      const base = config.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434/v1';
      return {
        provider: 'ollama',
        client: new OpenAI({ apiKey: 'ollama', baseURL: base }),
        defaultModel: config.get<string>('OLLAMA_MODEL') || 'codellama',
      };
    }
    case 'openai':
    default: {
      const apiKey = normalizeOpenAIKey(config.get<string>('OPENAI_API_KEY'));
      if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
      return {
        provider: 'openai',
        client: new OpenAI({ apiKey }),
        defaultModel: config.get<string>('OPENAI_MODEL_AGENT') || 'gpt-4o',
      };
    }
  }
}

function detectProvider(config: ConfigService): LLMProvider {
  const explicit = config.get<string>('LLM_PROVIDER')?.toLowerCase();
  if (explicit === 'deepseek' && config.get('DEEPSEEK_API_KEY')) return 'deepseek';
  if (explicit === 'groq' && config.get('GROQ_API_KEY')) return 'groq';
  if (explicit === 'ollama') return 'ollama';
  return 'openai';
}

export function listAvailableProviders(config: ConfigService): Array<{ id: string; name: string; configured: boolean }> {
  return [
    { id: 'openai', name: 'OpenAI', configured: !!normalizeOpenAIKey(config.get('OPENAI_API_KEY')) },
    { id: 'anthropic', name: 'Anthropic Claude', configured: !!config.get('ANTHROPIC_API_KEY') },
    { id: 'google', name: 'Google Gemini', configured: !!config.get('GOOGLE_AI_API_KEY') },
    { id: 'deepseek', name: 'DeepSeek', configured: !!config.get('DEEPSEEK_API_KEY') },
    { id: 'groq', name: 'Groq', configured: !!config.get('GROQ_API_KEY') },
    { id: 'mistral', name: 'Mistral', configured: !!config.get('MISTRAL_API_KEY') },
    { id: 'ollama', name: 'Ollama (local)', configured: true },
  ];
}
