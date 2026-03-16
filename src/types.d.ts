declare module 'node-summarizer' {
  export class SummarizerManager {
    constructor(text: string, numberOfSentences: number);
    getSummaryByRank(): Promise<{ summary: string }>;
  }
}
