'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'

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
          throw new Error(message || 'Nao foi possivel interpretar a leitura.')
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
          throw new Error('Stream indisponivel.')
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
          <p className="mystica-label">Interpretacao</p>
          <h2 className="font-display mt-3 text-4xl text-[var(--foreground)]">
            A voz do oraculo
          </h2>
        </div>
        {status === 'loading' || status === 'streaming' ? (
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--accent)] [animation:pulse-soft_2.4s_ease-in-out_infinite]">
            Mystica esta lendo
          </span>
        ) : null}
      </div>

      <div className="mystica-scroll mt-8 max-h-[420px] overflow-y-auto pr-2">
        <p className="text-sm leading-8 text-[var(--foreground)]/92 md:text-[15px]">
          <span className={text ? 'mystica-fade-in' : ''}>{text || 'Respire. O silencio antecede a revelacao.'}</span>
        </p>
      </div>

      {status === 'error' && (
        <div className="mt-6 rounded-3xl border border-red-300/20 bg-red-950/20 px-4 py-4 text-sm text-red-100/90">
          <p>{error}</p>
          <p className="mt-2 text-red-100/70">
            Recarregue a pagina para tentar novamente sem criar uma nova leitura.
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
