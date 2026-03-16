export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  content?: string;
  summary?: string;
  score?: number;
}

export interface ProcessedArticle {
  original: NewsItem;
  extractedSentences: string[];
  keywords: string[];
  tokensBefore: number;
  tokensAfter: number;
}

export interface AnalysisResult {
  title: string;
  url: string;
  source: string;
  category: string;
  importance: number;
  summary: string;
  keyPoints: string[];
  relatedTopics: string[];
}

export interface DigestResult {
  date: string;
  totalCollected: number;
  afterDedup: number;
  analyzed: number;
  delivered: number;
  articles: AnalysisResult[];
}

export interface ArticleSummary {
  title: string;
  url: string;
  summary: string;
}

export interface SimilarityGroup {
  representative: ArticleSummary;
  similar: ArticleSummary[];
}
