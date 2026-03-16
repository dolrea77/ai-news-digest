import { AnalysisResult } from '../collectors/types';

export function buildAnalysisPrompt(language: string): string {
  return `당신은 AI 기술 뉴스 분석 전문가입니다.
아래 기사들을 분석하여 다음 JSON 배열 형식으로 응답해주세요.

각 기사에 대해:
- category: "LLM" | "Computer Vision" | "Robotics" | "AI Infrastructure" | "AI Policy" | "Research" | "Product" | "Other"
- importance: 1~5 (5가 가장 중요)
- summary: ${language === 'ko' ? '한국어' : '영어'}로 2~3문장 요약
- keyPoints: 핵심 포인트 2~3개 배열
- relatedTopics: 관련 토픽 키워드 배열

응답 형식:
[
  {
    "title": "기사 제목",
    "url": "기사 URL",
    "source": "출처",
    "category": "카테고리",
    "importance": 5,
    "summary": "요약",
    "keyPoints": ["포인트1", "포인트2"],
    "relatedTopics": ["토픽1", "토픽2"]
  }
]

JSON만 응답해주세요. 다른 텍스트는 포함하지 마세요.`;
}

export function buildTrendPrompt(language: string): string {
  const lang = language === 'ko' ? '한국어' : '영어';
  return `당신은 AI 기술 트렌드 분석가입니다.
아래 기사들의 키워드와 주제를 분석하여, 최근 반복적으로 등장하는 트렌드를 파악해주세요.

${lang}로 다음 JSON 형식으로 응답해주세요:
{
  "trends": [
    {
      "topic": "트렌드 주제",
      "frequency": 3,
      "description": "트렌드 설명 (1~2문장)",
      "relatedArticles": ["관련 기사 제목1", "관련 기사 제목2"]
    }
  ],
  "summary": "전체 트렌드 요약 (2~3문장)"
}

JSON만 응답해주세요.`;
}

export interface TrendResult {
  trends: Array<{
    topic: string;
    frequency: number;
    description: string;
    relatedArticles: string[];
  }>;
  summary: string;
}

export function parseTrendResponse(response: string): TrendResult | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as TrendResult;
  } catch {
    console.error('트렌드 분석 응답 파싱 실패');
    return null;
  }
}

export function parseAnalysisResponse(response: string): AnalysisResult[] {
  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]) as AnalysisResult[];
  } catch {
    console.error('AI 분석 응답 파싱 실패');
    return [];
  }
}
