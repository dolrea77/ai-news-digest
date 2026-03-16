import * as fs from 'fs';
import * as path from 'path';
import { NewsItem } from '../collectors/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SEEN_URLS_PATH = path.join(DATA_DIR, 'seen-urls.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSeenUrls(): Set<string> {
  try {
    if (!fs.existsSync(SEEN_URLS_PATH)) return new Set();
    const raw = JSON.parse(fs.readFileSync(SEEN_URLS_PATH, 'utf-8'));
    if (!Array.isArray(raw) || !raw.every(u => typeof u === 'string')) {
      throw new Error('Invalid format');
    }
    return new Set(raw);
  } catch {
    console.warn('seen-urls.json 손상 — 빈 상태로 초기화합니다');
    return new Set();
  }
}

function saveSeenUrls(urls: Set<string>): void {
  ensureDataDir();
  fs.writeFileSync(SEEN_URLS_PATH, JSON.stringify([...urls], null, 2));
}

export function filterByUrlHistory(items: NewsItem[]): NewsItem[] {
  const seenUrls = loadSeenUrls();
  const newItems = items.filter(item => !seenUrls.has(item.url));

  // 새로운 URL을 이력에 추가
  for (const item of newItems) {
    seenUrls.add(item.url);
  }
  saveSeenUrls(seenUrls);

  console.log(`URL 중복 제거: ${items.length}건 → ${newItems.length}건 (${items.length - newItems.length}건 제거)`);
  return newItems;
}
