import { SummarizerManager } from 'node-summarizer';

/**
 * TextRank 기반 핵심 문장 추출
 * 원문에서 가장 중요한 문장 3~5개를 추출하여 토큰 사용량 절감
 */
export async function extractKeySentences(text: string, numberOfSentences = 5): Promise<string[]> {
  if (!text || text.trim().length < 100) {
    return [text.trim()];
  }

  try {
    const summarizer = new SummarizerManager(text, numberOfSentences);
    const summary = await summarizer.getSummaryByRank();

    if (summary && summary.summary) {
      const sentences = summary.summary
        .split(/(?<=[.!?])\s+/)
        .filter((s: string) => s.trim().length > 10);
      return sentences.length > 0 ? sentences : [text.slice(0, 500)];
    }
    return [text.slice(0, 500)];
  } catch {
    console.warn('TextRank 추출 실패 — 원문 앞부분을 사용합니다');
    return [text.slice(0, 500)];
  }
}

/**
 * 전처리 전후 토큰 수 추정 (대략 4자 = 1토큰)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
