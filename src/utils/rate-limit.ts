/**
 * 타임아웃 래퍼
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`타임아웃 (${ms}ms)`)), ms),
    ),
  ]);
}

/**
 * Exponential backoff retry 로직 (개별 호출 타임아웃 포함)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
  timeoutMs = 120000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) break;

      const delay = baseDelayMs * Math.pow(2, attempt);
      console.warn(`재시도 ${attempt + 1}/${maxRetries} (${delay}ms 대기): ${lastError.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * 동시성 제한 실행
 * 한 번에 최대 concurrency개의 작업만 동시에 실행
 */
export async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency = 3,
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = task().then(result => {
      results.push(result);
    });

    executing.push(p);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex(e => e === p),
        1,
      );
    }
  }

  await Promise.all(executing);
  return results;
}
