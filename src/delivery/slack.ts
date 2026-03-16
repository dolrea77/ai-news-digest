import axios from 'axios';
import { AnalysisResult } from '../collectors/types';
import { validateWebhookUrl } from '../utils/sanitize';

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string }>;
  fields?: Array<{ type: string; text: string }>;
}

function buildBlocks(articles: AnalysisResult[]): SlackBlock[] {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📰 AI 뉴스 데일리 브리핑 (${new Date().toLocaleDateString('ko-KR')})`,
        emoji: true,
      },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `총 *${articles.length}건*의 주요 뉴스` }],
    },
    { type: 'divider' },
  ];

  for (const article of articles) {
    const stars = '⭐'.repeat(Math.min(article.importance, 5));

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${stars} *<${article.url}|${article.title}>*\n${article.summary}`,
      },
    });

    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*카테고리:* ${article.category}` },
        { type: 'mrkdwn', text: `*출처:* ${article.source}` },
        { type: 'mrkdwn', text: `*중요도:* ${article.importance}/5` },
        { type: 'mrkdwn', text: `*핵심:* ${article.keyPoints.join(', ')}` },
      ],
    });

    blocks.push({ type: 'divider' });
  }

  return blocks;
}

export async function sendToSlack(articles: AnalysisResult[], webhookUrl: string): Promise<void> {
  validateWebhookUrl(webhookUrl, 'slack');

  if (articles.length === 0) {
    console.log('전송할 기사가 없습니다.');
    return;
  }

  const blocks = buildBlocks(articles);

  // Slack은 한 메시지에 최대 50개 block
  const chunks: SlackBlock[][] = [];
  for (let i = 0; i < blocks.length; i += 50) {
    chunks.push(blocks.slice(i, i + 50));
  }

  for (let i = 0; i < chunks.length; i++) {
    await axios.post(webhookUrl, { blocks: chunks[i] }, { timeout: 10000 });
    console.log(`Slack 전송 완료: 블록 ${chunks[i].length}개 (${i + 1}/${chunks.length})`);

    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
