import natural from 'natural';

const TfIdf = natural.TfIdf;

/**
 * TF-IDF 기반 키워드 추출
 * 문서 내에서 가장 중요한 키워드를 추출
 */
export function extractKeywords(text: string, maxKeywords = 10): string[] {
  if (!text || text.trim().length < 50) {
    return [];
  }

  try {
    const tfidf = new TfIdf();
    tfidf.addDocument(text);

    const terms: Array<{ term: string; tfidf: number }> = [];
    tfidf.listTerms(0).forEach((item: { term: string; tfidf: number }) => {
      // 2글자 이상, 숫자만으로 구성되지 않은 단어만
      if (item.term.length >= 2 && !/^\d+$/.test(item.term)) {
        terms.push(item);
      }
    });

    return terms
      .sort((a, b) => b.tfidf - a.tfidf)
      .slice(0, maxKeywords)
      .map(t => t.term);
  } catch {
    console.warn('TF-IDF 키워드 추출 실패');
    return [];
  }
}
