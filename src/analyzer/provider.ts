import { ArticleSummary, SimilarityGroup } from '../collectors/types';

export interface AIProvider {
  analyze(prompt: string, context: string): Promise<string>;
  groupSimilar(articles: ArticleSummary[]): Promise<SimilarityGroup[]>;
}

export interface AIProviderConfig {
  provider: 'anthropic' | 'openai' | 'custom';
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
}

export function createAIProvider(config: AIProviderConfig): AIProvider {
  switch (config.provider) {
    case 'anthropic': {
      const { AnthropicProvider } = require('./anthropic');
      return new AnthropicProvider(config);
    }
    case 'openai':
    case 'custom': {
      const { OpenAIProvider } = require('./openai');
      return new OpenAIProvider(config);
    }
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}
