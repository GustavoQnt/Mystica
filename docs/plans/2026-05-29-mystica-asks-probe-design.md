# Mystica Pergunta — Sondagem Ancorada nas Cartas (Design Spec)

**Data:** 2026-05-29
**Origem:** Clientes acham a leitura rasa. A alavanca de especificidade *real* (não retórica) é dar à Mystica material verdadeiro sobre a consulente — como tarô de verdade, onde a taróloga pergunta.
**Decisões da entrevista:**
- Formato **(B)**: a Mystica gera perguntas sob medida (não campos fixos de formulário).
- Timing **(B)**: **depois** de virar as cartas — sondagem ancorada na tiragem real.
- Por que importa: ataca diretamente a *confabulação confiante* (modelo deixa de inventar o padrão e passa a ler o real) E reforça imersão/marca (parece taróloga lendo o jogo) — o único moat do produto.

---

## Fluxo

1. Usuária escreve pergunta + escolhe estilo + spread → `POST /api/reading/draw` (existente). Reading fica `status: 'drawn'`.
2. Cartas viram na tela (clímax preservado — a sondagem vem **depois** do reveal).
3. **NOVO** `POST /api/reading/[id]/probe` → Gemini olha pergunta + cartas + conhecimento RAG e gera **1-3 perguntas afiadas, ancoradas nas cartas, na voz da Mystica** (ex.: "A Torre tá no seu presente — o que já tá rachando aí?"). Retorna JSON, sem streaming.
4. Frontend mostra as perguntas com campo de resposta opcional + botão **"Pular, leia assim mesmo"**.
5. Usuária responde (ou pula).
6. `POST /api/reading/[id]/interpret` (estendido) recebe as respostas → criptografa em `extra_context` → injeta no prompt → leitura final afirmativa, agora citando as palavras reais dela.

**Sem regressão:** se pular tudo, o interpret roda exatamente como hoje.

---

## Mudanças por arquivo

### Schema
- `readings.extra_context TEXT` (nullable) — já previsto na migração do roadmap. Guarda envelope criptografado `{ qa: [{ q, a }] }`.
- Sem tabela nova.

### `src/lib/prompts.ts`
- Novo prompt de sondagem + schema de saída estruturada:
  - System: "Você é Mystica. Olhou a tiragem. Antes de cravar, faça 1-3 perguntas **ancoradas em cartas específicas** que te deixariam ler com mais precisão. Na sua voz ({estilo}). Proibido: pergunta genérica ('como você se sente?'), só sim/não, ou mais de 3."
  - Schema: `{ questions: string[] }` (min 1, max 3).
- `buildReadingPrompt(ctx)` ganha campo opcional `probeContext` → renderiza seção `[O QUE A CONSULENTE RESPONDEU]` antes de "Faça a leitura". O BASE já manda citar as palavras dela — agora há palavras reais pra citar.

### `src/lib/rag.ts`
- `buildReadingContext()` ganha param opcional `probeContext` e repassa a `buildReadingPrompt`.

### `src/app/api/reading/[id]/probe/route.ts` (novo)
- Auth + `checkRateLimit(user.id)` (chama Gemini → precisa de escudo, igual interpret).
- Reading precisa estar `drawn`.
- Monta contexto (cartas + pergunta + RAG) → `streamInterpretation`/chamada estruturada → 1-3 perguntas.
- Persiste as perguntas em `extra_context` (envelope com `a` vazio) pra parear depois e exibir no histórico.
- Retorna `{ questions }`.

### `src/app/api/reading/[id]/interpret/route.ts`
- Aceita body opcional `{ qa: { question, answer }[] }`.
- Criptografa em `extra_context` (`encryptForUser`).
- Decripta e passa `probeContext` formatado a `buildReadingContext`.
- Caminho de pular = comportamento atual intacto.
- Em regenerar: se body vazio mas `extra_context` existe, reusa o que está salvo.

### Frontend (`src/app/reading/...`)
- Após reveal, etapa de sondagem: perguntas na voz da Mystica + inputs opcionais + "Pular".
- Histórico: mostrar Q&A junto da leitura (decriptado), opcional.

---

## Aplicabilidade por spread
- `tres-cartas`: sim.
- `carta-do-dia`: **não** (carta passiva, sem pergunta).
- Futuros `sonho`/`leitura-dupla`: sim — encaixe natural.

## Custo e limites
- +1 chamada Gemini por leitura que sonda. A sondagem não conta como "leitura completa" (não mexe em `incrementCompletedReadings`). Rate limit cobre abuso.

## Riscos / decisões honestas
- **Completion risk:** etapa extra após o pico do reveal pode fazer gente sair. Mitigação: puláveis, na voz dela (ritual, não formulário), no máximo 3.
- **Qualidade das perguntas:** se a sondagem gerar pergunta genérica, perde o ponto inteiro. O prompt precisa proibir genérico e exigir âncora em carta específica. Vale testar a saída antes de lapidar a UX.
- **Confabulação residual:** se a usuária pular, voltamos à confabulação retórica. Isso é aceitável (escolha dela) — o ganho existe pra quem responde.

## Testes
- `probe/route`: retorna 1-3 perguntas; 401 sem auth; 429 rate limit; 409 se não-`drawn`.
- `prompts`: `buildReadingPrompt` com `probeContext` renderiza a seção; sem ele, inalterado.
- `interpret/route`: body `qa` criptografa em `extra_context` e injeta no prompt; body vazio = caminho atual.

## Próximo passo recomendado
Testar **a qualidade da sondagem** isolada (gerar perguntas pra 3-4 tiragens reais) antes de construir a UX inteira. Se as perguntas saírem afiadas e na voz dela, vale o fluxo completo; se saírem genéricas, lapidar o prompt primeiro.
