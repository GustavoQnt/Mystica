'use client'

import { useEffect, useRef, useState } from 'react'

import type { ProbeQA } from '@/lib/probe'

interface ProbeStepProps {
  readingId: string
  onDone: (qa: ProbeQA[]) => void
}

/**
 * After the cards are revealed, Mystica asks 1-3 card-anchored questions.
 * The querent can answer (sharper reading) or skip (reads anyway). If the probe
 * returns nothing, this step resolves itself immediately.
 */
export function ProbeStep({ readingId, onDone }: ProbeStepProps) {
  const [questions, setQuestions] = useState<string[] | null>(null)
  const [answers, setAnswers] = useState<string[]>([])
  // Latest onDone for the effect path (avoids re-running the probe fetch when
  // the parent re-renders). Click handlers call onDone directly.
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const res = await fetch(`/api/reading/${readingId}/probe`, {
          method: 'POST',
        })
        const data = res.ok ? await res.json() : { questions: [] }
        if (!active) {
          return
        }
        const qs: string[] = Array.isArray(data.questions) ? data.questions : []
        if (qs.length === 0) {
          onDoneRef.current([])
          return
        }
        setQuestions(qs)
        setAnswers(qs.map(() => ''))
      } catch {
        if (active) {
          onDoneRef.current([])
        }
      }
    }

    load()
    return () => {
      active = false
    }
  }, [readingId])

  function handleContinue() {
    const qa = (questions ?? []).map((question, index) => ({
      question,
      answer: answers[index] ?? '',
    }))
    onDone(qa)
  }

  if (questions === null) {
    return (
      <section className="mystica-panel rounded-[2rem] px-6 py-8 md:px-8">
        <p className="mystica-label">Antes de cravar</p>
        <p className="mt-5 text-sm leading-7 text-[var(--muted)] [animation:pulse-soft_2.4s_ease-in-out_infinite]">
          Mystica está olhando o jogo...
        </p>
      </section>
    )
  }

  return (
    <section className="mystica-panel rounded-[2rem] px-6 py-8 md:px-8">
      <p className="mystica-label">Mystica quer saber</p>
      <h2 className="font-display mt-3 text-4xl text-[var(--foreground)]">
        Antes de eu cravar a leitura
      </h2>
      <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
        Responda o que quiser — quanto mais eu souber, mais a leitura é sobre
        você de verdade. Ou pule, que eu leio assim mesmo.
      </p>

      <div className="mt-8 grid gap-6">
        {questions.map((question, index) => (
          <label key={index} className="grid gap-3">
            <span className="text-sm leading-7 text-[var(--foreground)]/92">
              {question}
            </span>
            <textarea
              value={answers[index] ?? ''}
              onChange={(event) =>
                setAnswers((current) => {
                  const next = [...current]
                  next[index] = event.target.value
                  return next
                })
              }
              rows={2}
              placeholder="Sua resposta (opcional)"
              className="min-h-20 rounded-[1.25rem] border border-[var(--border)] bg-white/4 px-4 py-3 text-sm leading-7 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-strong)]"
            />
          </label>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 md:flex-row">
        <button
          type="button"
          onClick={() => onDone([])}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Pular, leia assim mesmo
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-[#1d1406]"
        >
          Continuar para a leitura
        </button>
      </div>
    </section>
  )
}
