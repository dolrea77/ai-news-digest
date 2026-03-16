import { AnalysisResult, NewsItem } from '../collectors/types';

export function filterByImportance(articles: AnalysisResult[], threshold: number): AnalysisResult[] {
  const filtered = articles.filter(a => a.importance >= threshold);
  console.log(`중요도 필터 (>=${threshold}): ${articles.length}건 → ${filtered.length}건`);
  return filtered;
}

/**
 * NEWS_SOURCES 환경변수 기반 소스 필터링
 * 쉼표로 구분된 소스 이름 목록으로 필터링
 */
export function filterBySources(items: NewsItem[], sourcesEnv?: string): NewsItem[] {
  if (!sourcesEnv || sourcesEnv.trim() === '') return items;

  const allowedSources = sourcesEnv
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);

  if (allowedSources.length === 0) return items;

  const filtered = items.filter(item =>
    allowedSources.some(s => item.source.toLowerCase().includes(s)),
  );

  console.log(`소스 필터: ${items.length}건 → ${filtered.length}건 (허용: ${allowedSources.join(', ')})`);
  return filtered;
}
