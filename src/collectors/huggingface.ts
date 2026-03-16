import axios from 'axios';
import { NewsItem } from './types';

const HF_PAPERS_URL = 'https://huggingface.co/api/daily_papers';

const AXIOS_CONFIG = {
  timeout: 15000,
  maxContentLength: 5 * 1024 * 1024,
};

interface HFPaper {
  title: string;
  paper: {
    id: string;
    summary: string;
    authors: Array<{ name: string }>;
  };
  publishedAt: string;
  numLikes: number;
}

export async function collectHuggingFacePapers(): Promise<NewsItem[]> {
  try {
    const response = await axios.get(HF_PAPERS_URL, AXIOS_CONFIG);
    const papers: HFPaper[] = response.data || [];

    const items: NewsItem[] = papers.map(paper => ({
      title: paper.title,
      url: `https://huggingface.co/papers/${paper.paper.id}`,
      source: 'Hugging Face Papers',
      publishedAt: paper.publishedAt || new Date().toISOString(),
      content: paper.paper.summary || '',
      summary: paper.paper.summary?.slice(0, 500),
      score: paper.numLikes,
    }));

    console.log(`Hugging Face Papers: ${items.length}건 수집`);
    return items;
  } catch (error) {
    console.error('HF Papers 수집 실패:', error instanceof Error ? error.message : error);
    return [];
  }
}
