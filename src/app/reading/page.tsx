'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AppHeader } from '@/components/AppHeader'
import { CardFan } from '@/components/CardFan'
import type { ReadingStyle } from '@/lib/reading-style'
import { SPREAD_SIZES, type SpreadType } from '@/lib/tarot'

type Step = 'intention' | 'fan'

export default function ReadingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('intention')
  const [question, setQuestion] = useState('')
  const [spreadType, setSpreadType] = useState<SpreadType>('tres-cartas')
  const [readingStyle, setReadingStyle] = useState<ReadingStyle | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDraw(fanIndices: number[]) {
    if (!readingStyle) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/reading/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spread_type: spreadType,
          reading_style: readingStyle,
          fan_indices: fanIndices,
          question,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Não foi possível selar a tiragem.')
      }

      router.push(`/reading/${data.reading_id}`)
    } catch (drawError) {
      setError(drawError instanceof Error ? drawError.message : 'Falha ao iniciar leitura.')
    } finally {
      setSubmitting(false)
    }
  }

  const canContinue = question.trim().length >= 3 && readingStyle !== null

  return (
    <main className="mystica-shell">
      <AppHeader />

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-10 md:pt-14">
        <div className="mystica-fade-up mx-auto max-w-3xl text-center">
          <p className="mystica-label">Nova tiragem</p>
          <h1 className="font-display mt-5 text-5xl leading-none text-[var(--foreground)] md:text-7xl">
            Abra um espaço limpo para a pergunta certa.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
            Primeiro nomeie a intenção. Depois escolha como quer receber a verdade e
            deixe a intuição selecionar as cartas.
          </p>
        </div>

        {step === 'intention' ? (
          <section className="mystica-panel mystica-fade-up mx-auto mt-12 max-w-3xl rounded-[2rem] px-6 py-8 md:px-8 md:py-10">
            <div className="grid gap-8">
              <label className="grid gap-3">
                <span className="mystica-label">Sua pergunta</span>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={5}
                  placeholder="O que em mim precisa ser visto agora?"
                  className="min-h-40 rounded-[1.5rem] border border-[var(--border)] bg-white/4 px-5 py-4 text-sm leading-7 text-[var(--foreground)] outline-none placeholder:text-[var(--muted-strong)]"
                />
              </label>

              <div>
                <p className="mystica-label">Tipo de tiragem</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <SelectionOption
                    title="Três cartas"
                    subtitle="Passado, presente e futuro"
                    active={spreadType === 'tres-cartas'}
                    onClick={() => setSpreadType('tres-cartas')}
                  />
                  <SelectionOption
                    title="Carta do dia"
                    subtitle="Um foco único para o agora"
                    active={spreadType === 'carta-do-dia'}
                    onClick={() => setSpreadType('carta-do-dia')}
                  />
                </div>
              </div>

              <div>
                <p className="mystica-label">Estilo da leitura</p>
                <div className="mt-4 grid gap-4">
                  <SelectionOption
                    title="Sincera"
                    subtitle="Verdade nua e crua, sem enrolação."
                    active={readingStyle === 'sincera'}
                    onClick={() => setReadingStyle('sincera')}
                  />
                  <SelectionOption
                    title="Acolhedora"
                    subtitle="Verdade com mais cuidado e acolhimento."
                    active={readingStyle === 'acolhedora'}
                    onClick={() => setReadingStyle('acolhedora')}
                  />
                  <SelectionOption
                    title="Analítica"
                    subtitle="Verdade com leitura profunda de padrões, emoções e autoconhecimento."
                    active={readingStyle === 'analitica'}
                    onClick={() => setReadingStyle('analitica')}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
                  Voltar ao santuário
                </Link>
                <button
                  type="button"
                  onClick={() => setStep('fan')}
                  disabled={!canContinue}
                  className="rounded-full bg-[var(--accent)] px-7 py-3 text-sm font-semibold text-[#1d1406] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Continuar para escolher as cartas
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-auto mt-12 max-w-5xl">
            <CardFan
              required={SPREAD_SIZES[spreadType]}
              onComplete={handleDraw}
            />
            {error && (
              <div className="mx-auto mt-6 max-w-3xl rounded-[1.5rem] border border-red-300/20 bg-red-950/20 px-5 py-4 text-sm text-red-100/90">
                {error}
              </div>
            )}
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setStep('intention')}
                className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                disabled={submitting}
              >
                Voltar e editar minha pergunta
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

function SelectionOption({
  title,
  subtitle,
  active,
  onClick,
}: {
  title: string
  subtitle: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[1.6rem] border px-5 py-5 text-left ${
        active
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] bg-white/3'
      }`}
    >
      <p className="font-display text-3xl text-[var(--foreground)]">{title}</p>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{subtitle}</p>
    </button>
  )
}
