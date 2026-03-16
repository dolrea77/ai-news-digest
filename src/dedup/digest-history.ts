import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';
import { NewsItem } from '../collectors/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_PATH = path.join(DATA_DIR, 'digest-history.json');

interface DigestEntry {
  date: string;
  titles: string[];
  urls: string[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadHistory(): DigestEntry[] {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
    if (!Array.isArray(raw)) {
      throw new Error('Invalid format');
    }
    return raw;
  } catch {
    console.warn('digest-history.json 손상 — 빈 상태로 초기화합니다');
    return [];
  }
}

function saveHistory(history: DigestEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

/**
 * 과거 브리핑 이력 기반 중복 제거 (4차 필터)
 * 최근 N일 이내 브리핑된 기사 제외
 */
export function filterByDigestHistory(items: NewsItem[], retentionDays = 7): NewsItem[] {
  const history = loadHistory();
  const cutoff = dayjs().subtract(retentionDays, 'day');

  // 보존 기간 내 브리핑된 URL 수집
  const recentUrls = new Set<string>();
  const validHistory = history.filter(entry => dayjs(entry.date).isAfter(cutoff));
  for (const entry of validHistory) {
    for (const url of entry.urls) {
      recentUrls.add(url);
    }
  }

  const filtered = items.filter(item => !recentUrls.has(item.url));
  const removed = items.length - filtered.length;
  if (removed > 0) {
    console.log(`브리핑 이력 필터 (${retentionDays}일): ${items.length}건 → ${filtered.length}건 (${removed}건 제거)`);
  }

  return filtered;
}

/**
 * 현재 브리핑 결과를 이력에 기록
 */
export function recordDigest(items: NewsItem[], retentionDays = 7): void {
  const history = loadHistory();
  const cutoff = dayjs().subtract(retentionDays, 'day');

  // 보존 기간 초과 이력 제거
  const trimmed = history.filter(entry => dayjs(entry.date).isAfter(cutoff));

  // 오늘 브리핑 추가
  trimmed.push({
    date: dayjs().format('YYYY-MM-DD'),
    titles: items.map(i => i.title),
    urls: items.map(i => i.url),
  });

  saveHistory(trimmed);
}
