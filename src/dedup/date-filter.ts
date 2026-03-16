import dayjs from 'dayjs';
import { NewsItem } from '../collectors/types';

export function filterByDate(items: NewsItem[], hoursAgo = 24): NewsItem[] {
  const cutoff = dayjs().subtract(hoursAgo, 'hour');

  const filtered = items.filter(item => {
    const publishedAt = dayjs(item.publishedAt);
    if (!publishedAt.isValid()) return true; // 날짜 파싱 실패 시 포함
    return publishedAt.isAfter(cutoff);
  });

  console.log(`날짜 필터 (${hoursAgo}h): ${items.length}건 → ${filtered.length}건 (${items.length - filtered.length}건 제거)`);
  return filtered;
}
