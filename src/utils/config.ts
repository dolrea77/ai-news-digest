import * as dotenv from 'dotenv';
import { AIProviderConfig } from '../analyzer/provider';
import { maskApiKey } from './sanitize';

dotenv.config();

export function loadAIConfig(): AIProviderConfig {
  const provider = (process.env.AI_PROVIDER || 'anthropic') as AIProviderConfig['provider'];

  // API 키: AI_API_KEY 우선, 없으면 ANTHROPIC_API_KEY fallback
  const apiKey = process.env.AI_API_KEY
    || (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : undefined);

  if (!apiKey) {
    throw new Error('AI_API_KEY 또는 ANTHROPIC_API_KEY를 설정해주세요.');
  }

  const config: AIProviderConfig = {
    provider,
    apiKey,
    model: process.env.AI_MODEL || (provider === 'anthropic' ? 'claude-sonnet-4-6' : 'gpt-4o'),
    baseUrl: process.env.AI_BASE_URL || undefined,
    maxTokens: Number(process.env.AI_MAX_TOKENS) || 4096,
  };

  // [보안] API 키는 절대 평문 로깅하지 않음
  console.log(`AI 설정: provider=${config.provider}, model=${config.model}, key=${maskApiKey(config.apiKey)}`);

  return config;
}

export function loadAppConfig() {
  return {
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || undefined,
    slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || undefined,
    importanceThreshold: Number(process.env.IMPORTANCE_THRESHOLD) || 3,
    historyRetentionDays: Math.min(Number(process.env.HISTORY_RETENTION_DAYS) || 7, 14),
    digestLanguage: process.env.DIGEST_LANGUAGE || 'ko',
  };
}
