/**
 * Markdown 문법을 제거하여 평문 텍스트로 변환
 * TextRank/TF-IDF 전처리 입력에 Markdown 노이즈가 섞이지 않도록 사용
 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')                    // 헤더
    .replace(/\*\*([^*]+)\*\*/g, '$1')               // 볼드
    .replace(/\*([^*]+)\*/g, '$1')                   // 이탤릭
    .replace(/~~([^~]+)~~/g, '$1')                   // 취소선
    .replace(/`([^`]+)`/g, '$1')                     // 인라인 코드
    .replace(/```[\s\S]*?```/g, '')                  // 코드 블록
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')         // 링크 → 텍스트만
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')        // 이미지 → alt 텍스트만
    .replace(/^[-*+]\s+/gm, '')                      // 비순서 목록 마커
    .replace(/^\d+\.\s+/gm, '')                      // 순서 목록 마커
    .replace(/^>\s+/gm, '')                          // 인용
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')              // 수평선
    .replace(/\|[^|\n]+/g, '')                       // 테이블
    .replace(/\s+/g, ' ')
    .trim();
}
