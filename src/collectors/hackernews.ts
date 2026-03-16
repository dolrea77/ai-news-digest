import axios from 'axios';
import { NewsItem } from './types';

const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1/search';
const AI_KEYWORDS = ['AI', 'LLM', 'GPT', 'machine learning', 'deep learning', 'neural', 'transformer', 'anthropic', 'openai', 'llama', 'diffusion'];

const AXIOS_CONFIG = {
  timeout: 15000,
  maxContentLength: 5 * 1024 * 1024,
};

interface HNHit {
  title: string;
  url: string;
  points: number;
  created_at: string;
  objectID: string;
  num_comments: number;
  story_text?: string;
}

export async function collectHackerNews(minScore = 50): Promise<NewsItem[]> {
  const items: NewsItem[] = [];

  for (const keyword of AI_KEYWORDS.slice(0, 5)) {
    try {
      const response = await axios.get(HN_SEARCH_URL, {
        ...AXIOS_CONFIG,
        params: {
          query: keyword,
          tags: 'story',
          numericFilters: `points>=${minScore},created_at_i>${Math.floor(Date.now() / 1000) - 86400}`,
          hitsPerPage: 10,
        },
      });

      const hits: HNHit[] = response.data?.hits || [];

      for (const hit of hits) {
        if (!hit.url && !hit.story_text) continue;

        items.push({
          title: hit.title,
          url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
          source: 'Hacker News',
          publishedAt: hit.created_at,
          content: hit.story_text || '',
          score: hit.points,
        });
      }
    } catch (error) {
      console.error(`HN 검색 실패 (${keyword}):`, error instanceof Error ? error.message : error);
    }
  }

  // URL 기준 중복 제거
  const seen = new Set<string>();
  const unique = items.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  console.log(`Hacker News: ${unique.length}건 수집 (score >= ${minScore})`);
  return unique;
}
