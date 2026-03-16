import axios from 'axios';
import { AnalysisResult } from '../collectors/types';
import { validateWebhookUrl } from '../utils/sanitize';

import { TrendResult } from '../analyzer/prompts';

interface DiscordEmbed {
  title: string;
  description: string;
  url?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
}

const CATEGORY_COLORS: Record<string, number> = {
  LLM: 0x5865f2,
  'Computer Vision': 0x57f287,
  Robotics: 0xfe73f6,
  'AI Infrastructure': 0xfee75c,
  'AI Policy': 0xed4245,
  Research: 0x3498db,
  Product: 0xe67e22,
  Other: 0x95a5a6,
};

function buildEmbeds(articles: AnalysisResult[], stats?: { collected: number; dedup: number; merged: number }): DiscordEmbed[] {
  const embeds: DiscordEmbed[] = [];

  // 통계 요약 embed
  if (stats) {
    embeds.push({
      title: '📊 수집 통계',
      description: `수집 ${stats.collected}건 → 중복제거 ${stats.dedup}건 → 유사 통합 ${stats.merged}건 → 전송 ${articles.length}건`,
      color: 0x2f3136,
      fields: [],
    });
  }

  for (const article of articles) {
    embeds.push({
      title: `${'⭐'.repeat(Math.min(article.importance, 5))} ${article.title}`,
      description: article.summary,
      url: article.url,
      color: CATEGORY_COLORS[article.category] || CATEGORY_COLORS.Other,
      fields: [
        { name: '카테고리', value: article.category, inline: true },
        { name: '출처', value: article.source, inline: true },
        { name: '중요도', value: `${article.importance}/5`, inline: true },
        { name: '핵심 포인트', value: article.keyPoints.map(p => `• ${p}`).join('\n') },
      ],
      footer: article.relatedTopics.length > 0
        ? { text: `🏷️ ${article.relatedTopics.join(' · ')}` }
        : undefined,
    });
  }

  return embeds;
}

function buildTrendEmbed(trend: TrendResult): DiscordEmbed {
  return {
    title: '📈 트렌드 분석',
    description: trend.summary,
    color: 0x9b59b6,
    fields: trend.trends.slice(0, 5).map(t => ({
      name: `${t.topic} (${t.frequency}회)`,
      value: t.description,
    })),
  };
}

export async function sendToDiscord(
  articles: AnalysisResult[],
  webhookUrl: string,
  options?: { trend?: TrendResult; stats?: { collected: number; dedup: number; merged: number } },
): Promise<void> {
  validateWebhookUrl(webhookUrl, 'discord');

  if (articles.length === 0) {
    console.log('전송할 기사가 없습니다.');
    return;
  }

  const embeds = buildEmbeds(articles, options?.stats);
  if (options?.trend) {
    embeds.push(buildTrendEmbed(options.trend));
  }

  // Discord는 한 번에 10개 embed까지만 허용
  const chunks: DiscordEmbed[][] = [];
  for (let i = 0; i < embeds.length; i += 10) {
    chunks.push(embeds.slice(i, i + 10));
  }

  for (let i = 0; i < chunks.length; i++) {
    const payload: Record<string, unknown> = { embeds: chunks[i] };
    if (i === 0) {
      payload.content = `📰 **AI 뉴스 데일리 브리핑** (${new Date().toLocaleDateString('ko-KR')}) — ${articles.length}건`;
    }

    await axios.post(webhookUrl, payload, { timeout: 10000 });
    console.log(`Discord 전송 완료: ${chunks[i].length}건 (${i + 1}/${chunks.length})`);

    // Rate limit 방지
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
