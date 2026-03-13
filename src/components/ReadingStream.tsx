'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import type { SpreadType } from '@/lib/tarot'

interface ReadingStreamProps {
  readingId: string
  onCards: (payload: { card_ids: number[]; spread_type: SpreadType }) => void
  onComplete: () => void
  onError?: (message: string) => void
}

export function ReadingStream({
  readingId,
  onCards,
  onComplete,
  onError,
}: ReadingStreamProps) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'loading' | 'streaming' | 'done' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const emitCards = useEffectEvent(onCards)
  const emitComplete = useEffectEvent(onComplete)
  const emitError = useEffectEvent((message: string) => onError?.(message))

  useEffect(() => {
    mountedRef.current = true

    async function run() {
      try {
        const response = await fetch(`/api/reading/${readingId}/interpret`, {
          method: 'POST',
        })

        if (!response.ok) {
          const message = await response.text()
          throw new Error(message || 'Não foi possível interpretar a leitura.')
        }

        const contentType = response.headers.get('content-type') ?? ''

        if (contentType.includes('text/plain')) {
          const fullText = await response.text()
          if (!mountedRef.current) {
            return
          }

          setText(fullText)
          setStatus('done')
          emitComplete()
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Stream indisponível.')
        }

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() ?? ''

          for (const part of parts) {
            const event = parseEvent(part)
            if (!event) {
              continue
            }

            if (event.name === 'cards') {
              const payload = JSON.parse(event.data) as {
                card_ids: number[]
                spread_type: SpreadType
              }
              emitCards(payload)
              setStatus('streaming')
            }

            if (event.name === 'text') {
              const payload = JSON.parse(event.data) as { chunk: string }
              setText((current) => current + payload.chunk)
            }

            if (event.name === 'done') {
              setStatus('done')
              emitComplete()
            }

            if (event.name === 'error') {
              const payload = JSON.parse(event.data) as { message?: string }
              throw new Error(payload.message || 'A leitura foi interrompida.')
            }
          }
        }
      } catch (streamError) {
        if (!mountedRef.current) {
          return
        }

        setStatus('error')
        const message =
          streamError instanceof Error
            ? streamError.message
            : 'A leitura foi interrompida.'
        setError(message)
        emitError(message)
      }
    }

    run()

    return () => {
      mountedRef.current = false
    }
  }, [readingId])

  return (
    <section className="mystica-panel rounded-[2rem] px-6 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mystica-label">Interpretação</p>
          <h2 className="font-display mt-3 text-4xl text-[var(--foreground)]">
            A voz do oráculo
          </h2>
        </div>
        {status === 'loading' || status === 'streaming' ? (
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--accent)] [animation:pulse-soft_2.4s_ease-in-out_infinite]">
            Mystica está lendo
          </span>
        ) : null}
      </div>

      <div className="mystica-scroll mt-8 max-h-[420px] overflow-y-auto pr-2">
        <div
          className={`text-sm leading-8 text-[var(--foreground)]/92 md:text-[15px] mystica-prose ${
            text ? 'mystica-fade-in' : ''
          }`}
        >
          {text ? (
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-semibold mt-6 mb-4 text-[var(--accent)]">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-3 text-[var(--accent)]">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-[var(--accent)]">{children}</h3>,
                p: ({ children }) => <p className="mb-4">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 mb-4">{children}</ul>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                ol: ({ children }) => <ol className="list-decimal pl-5 mb-4">{children}</ol>,
                strong: ({ children }) => <strong className="font-semibold text-white/90">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
              }}
            >
              {text}
            </ReactMarkdown>
          ) : (
            <p>Respire. O silêncio antecede a revelação.</p>
          )}
        </div>
      </div>

      {status === 'error' && (
        <div className="mt-6 rounded-3xl border border-red-300/20 bg-red-950/20 px-4 py-4 text-sm text-red-100/90">
          <p>{error}</p>
          <p className="mt-2 text-red-100/70">
            Recarregue a página para tentar novamente sem criar uma nova leitura.
          </p>
        </div>
      )}
    </section>
  )
}

function parseEvent(rawEvent: string) {
  const lines = rawEvent.split('\n')
  const name = lines.find((line) => line.startsWith('event:'))?.replace('event:', '').trim()
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace('data:', '').trim())
    .join('\n')

  if (!name || !data) {
    return null
  }

  return { name, data }
}
