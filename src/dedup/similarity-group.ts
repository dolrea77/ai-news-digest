import { AIProvider } from '../analyzer/provider';
import { NewsItem, ArticleSummary, SimilarityGroup } from '../collectors/types';

/**
 * AI 기반 유사도 그룹핑 (3차 필터)
 * 같은 주제를 다루는 기사들을 AI로 통합
 */
export async function groupBySimilarity(
  items: NewsItem[],
  aiProvider: AIProvider,
): Promise<NewsItem[]> {
  if (items.length <= 1) return items;

  const summaries: ArticleSummary[] = items.map(item => ({
    title: item.title,
    url: item.url,
    summary: item.summary || item.content?.slice(0, 200) || '',
  }));

  try {
    const groups: SimilarityGroup[] = await aiProvider.groupSimilar(summaries);

    // 각 그룹에서 대표 기사만 선택
    const representativeUrls = new Set(groups.map(g => g.representative.url));
    const result = items.filter(item => representativeUrls.has(item.url));

    const merged = items.length - result.length;
    if (merged > 0) {
      console.log(`AI 유사도 그룹핑: ${items.length}건 → ${result.length}건 (${merged}건 통합)`);
    }

    return result;
  } catch (error) {
    console.error('AI 유사도 그룹핑 실패, 원본 유지:', error instanceof Error ? error.message : error);
    return items;
  }
}
