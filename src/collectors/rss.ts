import Parser from 'rss-parser';
import axios from 'axios';
import { NewsItem } from './types';
import { stripMarkdown } from '../utils/markdown';

// defuddle/node는 ESM-only — 동적 import 사용
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _defuddle: any = null;

async function getDefuddle(): Promise<(input: string, url?: string, options?: Record<string, unknown>) => Promise<{
  content: string;
  contentMarkdown?: string;
  title: string;
  author: string;
  published: string;
}>> {
  if (!_defuddle) {
    const mod = await import('defuddle/node');
    _defuddle = mod.Defuddle;
  }
  return _defuddle;
}

const RSS_FEEDS: Array<{ name: string; url: string }> = [
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'Microsoft AI Blog', url: 'https://blogs.microsoft.com/ai/feed/' },
];

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AI-News-Digest/1.0',
  },
});

const AXIOS_CONFIG = {
  timeout: 15000,
  maxContentLength: 5 * 1024 * 1024, // 5MB
  headers: { 'User-Agent': 'AI-News-Digest/1.0' },
};

async function fetchContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, AXIOS_CONFIG);
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xml')) {
      return '';
    }

    const Defuddle = await getDefuddle();
    const result = await Defuddle(response.data as string, url, { markdown: true });

    const raw = result.contentMarkdown || result.content || '';
    return (result.contentMarkdown
      ? stripMarkdown(raw)
      : raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    ).slice(0, 10000);
  } catch {
    return '';
  }
}

export async function collectRSS(feedUrls?: Array<{ name: string; url: string }>): Promise<NewsItem[]> {
  const feeds = feedUrls || RSS_FEEDS;
  const items: NewsItem[] = [];

  for (const feed of feeds) {
    try {
      console.log(`RSS 수집 중: ${feed.name}`);
      const result = await parser.parseURL(feed.url);

      for (const entry of result.items?.slice(0, 10) || []) {
        if (!entry.link || !entry.title) continue;

        const content = entry.contentSnippet || await fetchContent(entry.link);

        items.push({
          title: entry.title,
          url: entry.link,
          source: feed.name,
          publishedAt: entry.isoDate || entry.pubDate || new Date().toISOString(),
          content,
          summary: entry.contentSnippet?.slice(0, 500),
        });
      }

      console.log(`  ${feed.name}: ${result.items?.length || 0}건 수집`);
    } catch (error) {
      console.error(`  ${feed.name} RSS 수집 실패:`, error instanceof Error ? error.message : error);
    }
  }

  return items;
}
