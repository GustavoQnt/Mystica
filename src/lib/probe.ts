export interface ProbeQA {
  question: string
  answer: string
}

/**
 * Normalize an untrusted Q&A payload (from the request body or a decrypted
 * extra_context envelope) into at most 3 well-formed pairs.
 */
export function parseProbeQA(raw: unknown): ProbeQA[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (p): p is ProbeQA =>
        !!p &&
        typeof (p as ProbeQA).question === 'string' &&
        typeof (p as ProbeQA).answer === 'string'
    )
    .slice(0, 3)
}

/**
 * Build the plaintext probe section injected into the reading prompt.
 * Only answered pairs count; returns undefined when nothing was answered
 * (the reading then proceeds exactly as if no probe happened).
 */
export function formatProbeContext(qa: ProbeQA[]): string | undefined {
  const answered = qa.filter((p) => p.answer.trim().length > 0)
  if (answered.length === 0) return undefined
  return answered
    .map((p) => `P: ${p.question.trim()}\nR: ${p.answer.trim()}`)
    .join('\n\n')
}
