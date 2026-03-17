import axios from 'axios';
import * as cheerio from 'cheerio';
import { NewsItem } from './types';

interface ScrapeSiteConfig {
  name: string;
  listUrl: string;
  baseUrl: string;
  selectors: {
    articleLink: string;
    title: string;
    date: string;
  };
  parseArticleUrl: (href: string, baseUrl: string) => string;
  maxItems: number;
}

const SCRAPE_SITES: ScrapeSiteConfig[] = [
  {
    name: 'Anthropic News',
    listUrl: 'https://www.anthropic.com/news',
    baseUrl: 'https://www.anthropic.com',
    selectors: {
      articleLink: 'a[href^="/news/"]',
      title: 'h3',
      date: 'span',
    },
    parseArticleUrl: (href, baseUrl) =>
      href.startsWith('http') ? href : `${baseUrl}${href}`,
    maxItems: 10,
  },
  {
    name: 'Claude Blog',
    listUrl: 'https://claude.com/blog',
    baseUrl: 'https://claude.com',
    selectors: {
      articleLink: 'a[href*="/blog/"]',
      title: 'h3, .card_blog_title',
      date: 'p, .card_blog_date',
    },
    parseArticleUrl: (href, baseUrl) =>
      href.startsWith('http') ? href : `${baseUrl}${href}`,
    maxItems: 10,
  },
  {
    name: 'Meta AI Blog',
    listUrl: 'https://ai.meta.com/blog/',
    baseUrl: 'https://ai.meta.com',
    selectors: {
      articleLink: 'a[href*="/blog/"]',
      title: 'h2, h3',
      date: 'time, span',
    },
    parseArticleUrl: (href, baseUrl) =>
      href.startsWith('http') ? href : `${baseUrl}${href}`,
    maxItems: 10,
  },
];

const AXIOS_CONFIG = {
  timeout: 15000,
  maxContentLength: 5 * 1024 * 1024,
  headers: { 'User-Agent': 'AI-News-Digest/1.0' },
};

function parseDate(dateStr: string): string {
  const cleaned = dateStr.trim();
  if (!cleaned) return new Date().toISOString();

  try {
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  } catch {
    // fall through
  }

  // "Mar 12, 2026" 등 패턴 시도
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const match = cleaned.match(/(\w{3})\w*\s+(\d{1,2}),?\s+(\d{4})/i);
  if (match) {
    const month = monthMap[match[1].toLowerCase()];
    if (month !== undefined) {
      return new Date(Number(match[3]), month, Number(match[2])).toISOString();
    }
  }

  return new Date().toISOString();
}

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, AXIOS_CONFIG);
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html')) {
      return '';
    }
    const $ = cheerio.load(response.data);
    $('script, style, nav, footer, header, aside, [role="navigation"]').remove();
    return $('article, main, .post-content, .entry-content, [role="main"], body')
      .first()
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000);
  } catch {
    return '';
  }
}

async function scrapeSite(config: ScrapeSiteConfig): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  const seenUrls = new Set<string>();

  try {
    console.log(`웹 스크래핑 수집 중: ${config.name}`);
    const response = await axios.get(config.listUrl, AXIOS_CONFIG);
    const $ = cheerio.load(response.data);

    const links = $(config.selectors.articleLink).toArray();

    for (const el of links) {
      if (items.length >= config.maxItems) break;

      const $el = $(el);
      const href = $el.attr('href');
      if (!href || href === '#' || href === config.listUrl) continue;

      // /blog/ 또는 /news/ 뒤에 실제 slug가 있는 링크만 수집
      const pathMatch = href.match(/\/(blog|news)\/([^/?#]+)/);
      if (!pathMatch || !pathMatch[2]) continue;

      const articleUrl = config.parseArticleUrl(href, config.baseUrl);
      if (seenUrls.has(articleUrl)) continue;
      seenUrls.add(articleUrl);

      // 제목: 링크 내부 또는 부모 컨테이너에서 찾기
      let title = $el.find(config.selectors.title).first().text().trim();
      if (!title) {
        title = $el.closest('article, div, li').find(config.selectors.title).first().text().trim();
      }
      if (!title) {
        title = $el.text().trim().split('\n')[0]?.trim();
      }
      if (!title || title.length < 5) continue;

      // 날짜: 링크 내부 또는 부모 컨테이너에서 찾기
      let dateStr = $el.find(config.selectors.date).first().text().trim();
      if (!dateStr || dateStr.length > 30) {
        dateStr = $el.closest('article, div, li').find(config.selectors.date).first().text().trim();
      }
      const publishedAt = parseDate(dateStr);

      items.push({
        title,
        url: articleUrl,
        source: config.name,
        publishedAt,
        content: '', // 나중에 채움
      });
    }

    // 본문 수집 (순차 — rate limit 고려)
    for (const item of items) {
      item.content = await fetchArticleContent(item.url);
      // 소스 서버 부담 경감을 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`  ${config.name}: ${items.length}건 수집`);
  } catch (error) {
    console.error(`  ${config.name} 스크래핑 실패:`, error instanceof Error ? error.message : error);
  }

  return items;
}

export async function collectFromWebScraper(
  sites?: ScrapeSiteConfig[],
): Promise<NewsItem[]> {
  const targets = sites || SCRAPE_SITES;
  const allItems: NewsItem[] = [];

  // 사이트별 순차 수집 (동시 요청으로 차단되지 않도록)
  for (const site of targets) {
    const items = await scrapeSite(site);
    allItems.push(...items);
  }

  return allItems;
}
