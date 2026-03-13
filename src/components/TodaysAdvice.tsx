interface AdviceData {
  action: string
  why: string
  timing: string
}

interface TodaysAdviceProps {
  advice?: AdviceData | null
  question?: string | null
  createdAt?: string | null
}

export function TodaysAdvice({
  advice,
  question,
  createdAt,
}: TodaysAdviceProps) {
  if (!advice) {
    return (
      <section className="mystica-panel mystica-fade-up mx-auto max-w-3xl rounded-[2rem] px-8 py-14 text-center">
        <p className="mystica-label">Seu santuário</p>
        <h1 className="font-display mt-5 text-5xl leading-none text-[var(--foreground)]">
          Sua primeira leitura ainda não foi aberta.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-sm leading-7 text-[var(--muted)] md:text-base">
          Quando você fizer sua primeira tiragem, o conselho essencial aparecerá aqui
          como uma memória viva do seu momento.
        </p>
      </section>
    )
  }

  return (
    <section className="mystica-panel mystica-glow mystica-fade-up mx-auto max-w-3xl rounded-[2rem] px-8 py-14 text-center">
      <p className="mystica-label">Conselho de hoje</p>
      <h1 className="font-display mt-5 text-5xl leading-none text-[var(--foreground)] md:text-6xl">
        {advice.action}
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">
        {advice.why}
      </p>
      <p className="mt-6 text-xs uppercase tracking-[0.32em] text-[var(--accent)]">
        {advice.timing}
      </p>
      {(question || createdAt) && (
        <div className="mt-10 border-t border-[var(--border)] pt-6 text-left text-sm text-[var(--muted)]">
          {question && <p>Pergunta: {question}</p>}
          {createdAt && <p className="mt-2">Última leitura: {new Date(createdAt).toLocaleDateString('pt-BR')}</p>}
        </div>
      )}
    </section>
  )
}
