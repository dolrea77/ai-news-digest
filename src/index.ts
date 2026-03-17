import { loadAIConfig, loadAppConfig } from './utils/config';
import { createAIProvider } from './analyzer/provider';
import { collectRSS } from './collectors/rss';
import { collectHackerNews } from './collectors/hackernews';
import { collectHuggingFacePapers } from './collectors/huggingface';
import { collectFromWebScraper } from './collectors/web-scraper';
import { filterByUrlHistory } from './dedup/url-history';
import { filterByDate } from './dedup/date-filter';
import { groupBySimilarity } from './dedup/similarity-group';
import { filterByDigestHistory, recordDigest } from './dedup/digest-history';
import { extractKeySentences, estimateTokens } from './preprocessor/extractor';
import { extractKeywords } from './preprocessor/keywords';
import { buildAnalysisPrompt, buildTrendPrompt, parseAnalysisResponse, parseTrendResponse } from './analyzer/prompts';
import { filterByImportance, filterBySources } from './utils/filter';
import { sendToDiscord } from './delivery/discord';
import { sendToSlack } from './delivery/slack';
import { withRetry } from './utils/rate-limit';
import { DigestResult, NewsItem } from './collectors/types';

async function main(): Promise<void> {
  console.log('=== AI News Daily Digest 시작 ===');
  console.log(`실행 시각: ${new Date().toLocaleString('ko-KR')}`);

  // 1. 설정 로드
  const aiConfig = loadAIConfig();
  const appConfig = loadAppConfig();
  const aiProvider = createAIProvider(aiConfig);

  // 2. 뉴스 수집 (모든 소스 병렬)
  console.log('\n--- Step 1: 뉴스 수집 ---');
  const [rssItems, hnItems, hfItems, webItems] = await Promise.all([
    collectRSS(),
    collectHackerNews(),
    collectHuggingFacePapers(),
    collectFromWebScraper(),
  ]);

  let collected: NewsItem[] = [...rssItems, ...hnItems, ...hfItems, ...webItems];
  console.log(`총 ${collected.length}건 수집 (RSS: ${rssItems.length}, HN: ${hnItems.length}, HF: ${hfItems.length}, Web: ${webItems.length})`);

  if (collected.length === 0) {
    console.log('수집된 뉴스가 없습니다. 종료합니다.');
    return;
  }

  // 소스 필터링 (NEWS_SOURCES 환경변수)
  collected = filterBySources(collected, process.env.NEWS_SOURCES);

  // 3. 중복 제거 (4단계)
  console.log('\n--- Step 2: 중복 제거 ---');
  const afterUrlFilter = filterByUrlHistory(collected);
  const afterDateFilter = filterByDate(afterUrlFilter);
  const afterHistoryFilter = filterByDigestHistory(afterDateFilter, appConfig.historyRetentionDays);
  const afterSimilarity = await groupBySimilarity(afterHistoryFilter, aiProvider);

  if (afterSimilarity.length === 0) {
    console.log('새로운 뉴스가 없습니다. 종료합니다.');
    return;
  }

  // 4. 로컬 전처리 (TextRank + TF-IDF)
  console.log('\n--- Step 3: 로컬 전처리 ---');
  let totalTokensBefore = 0;
  let totalTokensAfter = 0;

  for (const item of afterSimilarity) {
    if (!item.content) continue;
    const tokensBefore = estimateTokens(item.content);
    totalTokensBefore += tokensBefore;

    const sentences = await extractKeySentences(item.content);
    const keywords = extractKeywords(item.content);

    item.content = sentences.join(' ');
    item.summary = `[키워드: ${keywords.slice(0, 5).join(', ')}] ${sentences.slice(0, 2).join(' ')}`;

    totalTokensAfter += estimateTokens(item.content);
  }

  const reduction = totalTokensBefore > 0
    ? Math.round((1 - totalTokensAfter / totalTokensBefore) * 100)
    : 0;
  console.log(`전처리 완료: ~${totalTokensBefore} → ~${totalTokensAfter} 토큰 (${reduction}% 절감)`);

  // 5. AI 분석
  console.log('\n--- Step 4: AI 분석 ---');
  const analysisPrompt = buildAnalysisPrompt(appConfig.digestLanguage);

  const batches: NewsItem[][] = [];
  for (let i = 0; i < afterSimilarity.length; i += 10) {
    batches.push(afterSimilarity.slice(i, i + 10));
  }

  const allResults = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const context = batch.map((item, idx) => {
      const content = item.content || item.summary || '내용 없음';
      return `[기사 ${idx + 1}]\n제목: ${item.title}\nURL: ${item.url}\n출처: ${item.source}\n내용: ${content}`;
    }).join('\n\n---\n\n');

    console.log(`배치 ${i + 1}/${batches.length} 분석 중 (${batch.length}건)...`);
    const response = await withRetry(() => aiProvider.analyze(analysisPrompt, context));
    const results = parseAnalysisResponse(response);

    for (let j = 0; j < results.length && j < batch.length; j++) {
      results[j].url = results[j].url || batch[j].url;
      results[j].source = results[j].source || batch[j].source;
    }

    allResults.push(...results);
  }

  console.log(`AI 분석 완료: ${allResults.length}건`);

  // 6. 트렌드 분석
  console.log('\n--- Step 5: 트렌드 분석 ---');
  const trendPrompt = buildTrendPrompt(appConfig.digestLanguage);
  const trendContext = allResults.map(r => `${r.title}: ${r.summary}`).join('\n');
  let trendResult = null;
  try {
    const trendResponse = await withRetry(() => aiProvider.analyze(trendPrompt, trendContext));
    trendResult = parseTrendResponse(trendResponse);
    if (trendResult) {
      console.log(`트렌드 ${trendResult.trends.length}개 식별: ${trendResult.trends.map(t => t.topic).join(', ')}`);
    }
  } catch {
    console.warn('트렌드 분석 실패 — 건너뜁니다');
  }

  // 7. 중요도 필터링
  const important = filterByImportance(allResults, appConfig.importanceThreshold);

  // 8. 결과 전송
  console.log('\n--- Step 6: 결과 전송 ---');
  const deliveryStats = {
    collected: collected.length,
    dedup: afterSimilarity.length,
    merged: afterHistoryFilter.length - afterSimilarity.length,
  };

  if (appConfig.discordWebhookUrl) {
    await sendToDiscord(important, appConfig.discordWebhookUrl, {
      trend: trendResult || undefined,
      stats: deliveryStats,
    });
  } else {
    console.log('DISCORD_WEBHOOK_URL이 설정되지 않아 Discord 전송을 건너뜁니다.');
  }

  if (appConfig.slackWebhookUrl) {
    await sendToSlack(important, appConfig.slackWebhookUrl);
  } else {
    console.log('SLACK_WEBHOOK_URL이 설정되지 않아 Slack 전송을 건너뜁니다.');
  }

  // 9. 브리핑 이력 기록
  recordDigest(afterSimilarity, appConfig.historyRetentionDays);

  // 10. 결과 요약
  const digest: DigestResult = {
    date: new Date().toISOString().split('T')[0],
    totalCollected: collected.length,
    afterDedup: afterSimilarity.length,
    analyzed: allResults.length,
    delivered: important.length,
    articles: important,
  };

  console.log('\n=== 브리핑 완료 ===');
  console.log(`수집: ${digest.totalCollected}건 → 중복제거: ${digest.afterDedup}건 → 분석: ${digest.analyzed}건 → 전송: ${digest.delivered}건`);

  if (important.length > 0) {
    console.log('\n📰 주요 뉴스:');
    for (const article of important) {
      console.log(`  ${'⭐'.repeat(article.importance)} [${article.category}] ${article.title}`);
      console.log(`    ${article.summary}`);
      console.log(`    ${article.url}\n`);
    }
  }

  if (trendResult) {
    console.log('📈 트렌드:', trendResult.summary);
  }
}

main().catch(error => {
  console.error('실행 중 오류 발생:', error instanceof Error ? error.message : error);
  process.exit(1);
});
