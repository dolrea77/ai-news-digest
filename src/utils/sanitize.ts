/**
 * [보안] 외부 콘텐츠를 AI 프롬프트에 전달하기 전 새니타이징
 * - 제어 문자 제거 (prompt injection 벡터 차단)
 * - 길이 제한 (토큰 폭증 방지)
 */
export function sanitizeForPrompt(text: string, maxLength = 5000): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .slice(0, maxLength);
}

/**
 * [보안] AI_BASE_URL 검증 — SSRF 방지 + 원격 서버 HTTPS 강제
 */
export function validateBaseUrl(url: string): void {
  const parsed = new URL(url);
  const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname);

  if (!isLocalhost && parsed.protocol !== 'https:') {
    throw new Error('AI_BASE_URL은 원격 서버의 경우 HTTPS를 사용해야 합니다.');
  }

  const blockedPatterns = ['169.254.', 'metadata.google', '100.100.100.200'];
  if (blockedPatterns.some(p => parsed.hostname.includes(p))) {
    throw new Error('AI_BASE_URL에 내부 메타데이터 서비스 주소를 사용할 수 없습니다.');
  }
}

/**
 * [보안] Webhook URL 도메인 화이트리스트 검증
 */
export function validateWebhookUrl(url: string, type: 'discord' | 'slack'): void {
  const parsed = new URL(url);

  if (parsed.protocol !== 'https:') {
    throw new Error(`${type} webhook URL은 HTTPS를 사용해야 합니다.`);
  }

  const allowedHosts: Record<string, string[]> = {
    discord: ['discord.com', 'discordapp.com'],
    slack: ['hooks.slack.com'],
  };

  if (!allowedHosts[type]?.some(h => parsed.hostname.endsWith(h))) {
    throw new Error(`${type} webhook URL의 도메인이 허용 목록에 없습니다: ${parsed.hostname}`);
  }
}

/**
 * [보안] API 키 마스킹 — 로깅 시 사용
 */
export function maskApiKey(key: string): string {
  if (key.length <= 11) return '***';
  return key.slice(0, 7) + '...' + key.slice(-4);
}
