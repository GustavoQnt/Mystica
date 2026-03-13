# PRD: Mystica MVP

**Data:** 2026-03-12
**Status:** Em desenvolvimento
**Executado por:** Agente de IA
**Documentos de referência:**
- Spec: `docs/superpowers/specs/2026-03-12-mystica-design.md`
- Plano de implementação: `docs/superpowers/plans/2026-03-12-mystica-mvp.md`

> **Nota para agentes:** Este PRD define O QUÊ deve ser construído e os critérios de aceite. O COMO (stack, schemas SQL, endpoints, código) está nos documentos de referência acima — consulte-os antes de implementar cada user story.

---

## Status de Implementação

### Chunk 1: Project Bootstrap + Supabase ✅ Completo
- [x] Next.js 16 scaffoldado com TypeScript, Tailwind, ESLint, App Router
- [x] Dependências instaladas: `@supabase/supabase-js`, `@supabase/ssr`, `@pinecone-database/pinecone`, `@google/generative-ai`
- [x] Vitest configurado com jsdom + `@testing-library/react`
- [x] `.env.local.example` criado
- [x] `src/lib/supabase/client.ts` — cliente browser
- [x] `src/lib/supabase/server.ts` — cliente server
- [x] `src/lib/supabase/middleware.ts` + `middleware.ts` — proteção de rotas
- [x] `supabase/migrations/001_initial_schema.sql` — schema `profiles` + `readings` + RLS + trigger aplicado no Supabase
- [x] `src/app/auth/callback/route.ts` — OAuth callback
- [x] `src/app/login/page.tsx` — página de login com Google OAuth

### Chunk 2: Tarot Data + Card Logic ✅ Completo
- [x] `src/data/cards.json` — 78 cartas (Major + Minor Arcana em PT-BR)
- [x] `src/lib/tarot.ts` — `resolveCards`, `getCard`, `SPREAD_SIZES`, `POSITION_LABELS`
- [x] `src/lib/__tests__/tarot.test.ts` — 8 testes, todos passando

### Infraestrutura externa ✅ Completo
- [x] Supabase: projeto criado, schema aplicado, Google OAuth configurado
- [x] Pinecone: índice criado (dim=768, cosine, serverless us-east-1)
- [x] Gemini: API key configurada

### Chunk 3: RAG Pipeline ✅ Completo
- [x] `src/lib/pinecone.ts` — cliente Pinecone + hybrid search com filtro `card_id`
- [x] `src/lib/gemini.ts` — streaming narrativo + extração JSON de metadata
- [x] `src/lib/prompts.ts` — system prompt + prompt de leitura + schema de metadata
- [x] `src/lib/context-injection.ts` — recuperação e formatação das últimas 3 leituras
- [x] `src/lib/rag.ts` — orquestração de contexto (Pinecone + histórico Supabase)
- [x] `src/lib/reading-limits.ts` — reset lazy do ciclo mensal + incremento no `completed`

### Chunk 4: API Endpoints ✅ Completo
- [x] `src/app/api/reading/draw/route.ts` — sela cartas server-side + valida limite free
- [x] `src/app/api/reading/[id]/interpret/route.ts` — stream SSE + idempotência + persistência
- [x] `src/app/api/reading/[id]/route.ts` — leitura individual com ocultação de `card_ids` antes de `completed`
- [x] `src/app/api/history/route.ts` — histórico da usuária
### Chunk 5: UI / Telas ✅ Completo
- [x] `src/app/page.tsx` — Home/santuário com `TodaysAdvice` e mini-histórico
- [x] `src/app/reading/page.tsx` — intenção + seleção de spread + leque animado
- [x] `src/app/reading/[id]/page.tsx` — revelação + streaming + conselho prático + retry
- [x] `src/app/history/page.tsx` — histórico contemplativo da usuária
- [x] `src/components/CardFan.tsx` — leque animado com seleção de 78 cartas
- [x] `src/components/CardReveal.tsx` — revelação com fallback textual quando a imagem não existe
- [x] `src/components/ReadingStream.tsx` — consumo do stream SSE e renderização progressiva
- [x] `src/components/TodaysAdvice.tsx` — widget da home
### Chunk 6: Deploy + Ingest ⬜ Pendente

---

---

## Introdução

Mystica é um SaaS brasileiro de leituras de tarot potencializado por IA. A usuária escolhe cartas de um leque animado e recebe uma interpretação em streaming, em português brasileiro, com tom de taróloga experiente. O diferencial central é o **journaling sistêmico**: o contexto das leituras anteriores é injetado no prompt, fazendo com que Mystica pareça conhecer a trajetória da usuária.

O MVP valida a proposta de valor central — uma leitura completa end-to-end — com custo operacional próximo de zero no free tier das plataformas usadas.

---

## Goals

- Usuária consegue se autenticar e realizar uma leitura completa (intenção → leque → revelação → interpretação) sem erros
- Interpretação é gerada em streaming, em PT-BR, com vocabulário esotérico brasileiro
- Contexto das últimas 3 leituras é injetado no prompt (journaling básico)
- Limite de 5 leituras/mês para o plano gratuito é enforçado server-side
- Deploy funcional no Vercel com Supabase + Pinecone + Gemini integrados
- Base para monetização futura: campos de metadata (`themes`, `journaling_note`, `next_step_advice`) já coletados desde o primeiro dia

---

## User Stories

### US-001: Autenticação via Google ou magic link
**Descrição:** Como usuária, quero me autenticar com minha conta Google ou e-mail para acessar minhas leituras com segurança.

**Referência:** Auth Flow — `docs/superpowers/specs/2026-03-12-mystica-design.md`

**Acceptance Criteria:**
- [x] Página `/login` exibe opção: "Entrar com Google" *(magic link não implementado ainda)*
- [x] Após autenticação Google, usuária é redirecionada para `/` (Home) — callback `/auth/callback` implementado
- [ ] Após autenticação por magic link, usuária é redirecionada para `/`
- [x] Usuária não autenticada que tenta acessar qualquer rota `(auth)/` é redirecionada para `/login` — middleware implementado
- [x] Perfil (`profiles`) é criado automaticamente com `plan: 'free'` após primeiro login — trigger no schema
- [ ] Logout funciona e redireciona para `/login`

---

### US-002: Home com widget "Conselho de Hoje"
**Descrição:** Como usuária, quero ver na home o conselho prático da minha última leitura e um mini-histórico das tiragens recentes para sentir continuidade na minha jornada.

**Referência:** Fluxo da Usuária → ① Home

**Acceptance Criteria:**
- [x] Home exibe `next_step_advice` (action + timing) da leitura mais recente da usuária sem nova chamada à API do Gemini
- [x] Mini-histórico exibe thumbnails das cartas das últimas tiragens com data
- [x] Se não há leituras anteriores, exibe estado vazio com CTA "Fazer primeira leitura"
- [x] Botão "Nova Tiragem" está visível e navega para `/reading`

---

### US-003: Definição da intenção
**Descrição:** Como usuária, quero escrever minha pergunta e escolher o tipo de tiragem antes de começar, para que a leitura seja personalizada para o meu momento.

**Referência:** Fluxo da Usuária → ② Intenção

**Acceptance Criteria:**
- [x] Campo de texto para a pergunta/intenção (obrigatório, mínimo 3 caracteres)
- [x] Seleção do tipo de tiragem: "3 Cartas (passado / presente / futuro)" ou "Carta do Dia"
- [x] Botão "Concentrar →" só habilitado quando pergunta e tipo estão preenchidos
- [x] Ao avançar, usuária é levada para a tela do leque

---

### US-004: Leque animado e escolha de cartas
**Descrição:** Como usuária, quero visualizar o baralho em leque e tocar nas cartas para escolhê-las, sentindo que minha intuição guiou a escolha.

**Referência:** Fluxo da Usuária → ③ Leque; Arquitetura → `POST /api/reading/draw`

**Acceptance Criteria:**
- [x] 78 cartas exibidas em leque animado (verso), todas tocáveis
- [x] Cada carta selecionada muda de estado visual (destacada / levantada)
- [x] Progress bar indica quantas cartas foram escolhidas ("2 de 3 cartas escolhidas")
- [x] Ao completar a seleção, `POST /api/reading/draw` é chamado com `fan_indices` + `spread_type` + `question`
- [x] API retorna `reading_id`; client navega para `/reading/[id]`
- [x] Se usuária atingiu limite de 5 leituras/mês, exibe mensagem de limite atingido (sem acessar o leque)

---

### US-005: Revelação das cartas e streaming da interpretação
**Descrição:** Como usuária, quero ver as cartas virarem com a imagem real e a interpretação aparecer progressivamente, para sentir a magia do momento.

**Referência:** Fluxo da Usuária → ④ Revelação + Streaming; Arquitetura → `POST /api/reading/[id]/interpret`

**Acceptance Criteria:**
- [ ] Cartas aparecem com animação de "virar" revelando a imagem Visconti-Sforza em webp/avif
- [x] Nome da carta e posição (ex: "A Torre — Passado") exibidos abaixo de cada imagem
- [x] Estado de carregamento: "Mystica está lendo as cartas..." enquanto aguarda o início do stream
- [x] Texto da interpretação aparece progressivamente (efeito de digitação via stream)
- [x] Se o stream falha no meio, exibe mensagem de erro com botão "Tentar novamente" (retry idempotente)
- [x] IDs das cartas são recebidos no início do stream (não antes), impedindo que o usuário veja as cartas pela rede antes da animação

---

### US-006: Leitura completa com conselho prático
**Descrição:** Como usuária, quero ver a leitura completa com um conselho prático destacado, para saber exatamente o que fazer após a consulta.

**Referência:** Fluxo da Usuária → ⑤ Leitura completa; ResponseSchema → `next_step_advice`

**Acceptance Criteria:**
- [x] Texto narrativo completo da interpretação exibido após o stream concluir
- [x] Bloco "Conselho Prático" destacado visualmente, contendo: ação (`action`), motivo (`why`) e timing (`timing`)
- [x] Botão "Nova Tiragem" disponível ao final
- [x] Leitura salva com status `'completed'` no Supabase; reload da página exibe a leitura salva sem nova chamada ao Gemini

---

### US-007: Histórico de leituras
**Descrição:** Como usuária, quero ver todas as minhas leituras anteriores para acompanhar minha jornada ao longo do tempo.

**Referência:** Arquitetura → `GET /api/history`

**Acceptance Criteria:**
- [x] Página `/history` lista todas as leituras da usuária, ordenadas da mais recente para a mais antiga
- [x] Cada item exibe: data, tipo de tiragem, pergunta (truncada se longa), thumbnails das cartas
- [x] Clicar em uma leitura exibe a leitura completa (texto + conselho prático)
- [x] Usuária só vê suas próprias leituras (RLS enforçado)

---

### US-008: Limite do plano gratuito
**Descrição:** Como produto, quero limitar usuárias gratuitas a 5 leituras por mês, enforçado server-side, para viabilizar a monetização futura.

**Referência:** Monetização (Freemium); `POST /api/reading/draw` → erro 403

**Acceptance Criteria:**
- [x] Contador `readings_this_month` é incrementado a cada leitura concluída (`status = 'completed'`)
- [x] Ao início de um novo mês (cycle diferente), contador é resetado lazily antes da verificação
- [x] Se `readings_this_month >= 5` e `plan = 'free'`, `POST /api/reading/draw` retorna 403
- [ ] Front-end exibe mensagem amigável ao receber 403: "Você atingiu o limite de 5 leituras este mês"

---

### US-009: RAG com contexto de journaling
**Descrição:** Como usuária, quero que Mystica mencione padrões das minhas leituras anteriores, para sentir que ela me conhece.

**Referência:** RAG Orchestration; Context Injection; Gemini Pattern

**Acceptance Criteria:**
- [x] Até 3 leituras anteriores da usuária são recuperadas do Supabase e formatadas como contexto
- [x] Contexto é injetado no prompt da Call 1 do Gemini
- [x] Call 1 gera interpretação em streaming; Call 2 extrai metadata (themes, energy, journaling_note, next_step_advice) em JSON mode
- [x] Metadata é salva em `readings.metadata` no Supabase
- [x] Hybrid search no Pinecone: filtro `card_id` para significados canônicos + busca semântica para contextos temáticos

---

### US-010: Indexação da base de conhecimento no Pinecone
**Descrição:** Como desenvolvedor/operador, quero indexar os 78 arquivos `.md` das cartas no Pinecone para que o RAG funcione.

**Referência:** Pinecone — Ingestion Spec; `scripts/ingest.ts`

**Acceptance Criteria:**
- [ ] Script `scripts/ingest.ts` lê todos os `.md` de `knowledge/`
- [ ] Cada seção (`## Heading`) vira um vetor com metadata: `{ card_id, card_name, section, suit, arcana_type }`
- [ ] Embeddings gerados via `text-embedding-004`
- [ ] Upsert idempotente no Pinecone (ID = `card_id + section`)
- [ ] Script executa sem erros com os ~260 vetores esperados

---

## Functional Requirements

- [x] FR-1: Autenticação via Supabase Auth (Google OAuth + magic link); middleware Next.js protege rotas `(auth)/`
- [x] FR-2: Sorteio de cartas server-side — cliente envia `fan_indices`, servidor resolve `card_ids`; IDs não expostos antes da animação
- [x] FR-3: Leitura em dois passos: `draw` (sela cartas, persiste `status='drawn'`) → `interpret` (RAG + Gemini, persiste `status='completed'`)
- [x] FR-4: `interpret` é idempotente: se `status='completed'`, retorna interpretação salva sem nova chamada ao Gemini
- [x] FR-5: Streaming via `ReadableStream` do endpoint `POST /api/reading/[id]/interpret`
- [x] FR-6: Duas chamadas Gemini por leitura: Call 1 (streaming narrativo, ~4k tokens input) + Call 2 (JSON mode metadata, ~800 tokens input)
- [x] FR-7: Hybrid search Pinecone: filtro `card_id IN [...]` + busca semântica pela pergunta da usuária
- [x] FR-8: Context injection: últimas 3 leituras formatadas como texto e injetadas no prompt da Call 1
- [x] FR-9: Limite freemium: 5 leituras/mês por usuária no plano `'free'`, enforçado em `POST /api/reading/draw`
- [x] FR-10: Reset lazy do contador mensal via `month_cycle` (sem pg_cron, compatível com Supabase free tier)
- [x] FR-11: RLS no Supabase: usuária acessa apenas seus próprios `profiles` e `readings`
- [ ] FR-12: Imagens das cartas servidas de `public/cards/` em formato webp/avif
- [x] FR-13: `next_step_advice` exibido na Home sem nova chamada de API (lido do último `reading.metadata`)

---

## Non-Goals (Fora do MVP)

- Tiragens avançadas (Cruz Celta, etc.)
- Chat contínuo sobre a leitura
- Notificações push
- Compartilhamento de leituras
- Pagamentos e plano pago (Stripe / Mercado Pago)
- RAG avançado por usuária (embedding do histórico pessoal no Pinecone)
- Gemini Context Caching para o corpus das 78 cartas
- Testes automatizados (TDD) — qualidade validada via execução manual e critérios de aceite

---

## Design Considerations

- **Identidade visual:** Dark Mystical — roxo profundo (`#0d0d1a`, `#1a0a2e`, `#2d1b4e`), dourado (`#c9a96e`), tipografia serifada
- **Baralho:** Visconti-Sforza (séc. XV), domínio público, imagens em `public/cards/` como webp/avif
- **Tom de voz:** taróloga brasileira experiente — *axé*, *caminhos abertos*, *limpeza energética*, *amarração emocional*; direto, empático, nunca suaviza demais
- **Animações:** leque de cartas (CardFan), virada de carta (CardReveal), efeito de digitação no streaming

---

## Technical Considerations

- Toda decisão técnica detalhada está em `docs/superpowers/specs/2026-03-12-mystica-design.md`
- Todo passo de implementação está em `docs/superpowers/plans/2026-03-12-mystica-mvp.md`
- Agentes devem consultar esses documentos antes de implementar cada US
- Custo operacional do MVP: ~$0–15/mês (Vercel Hobby + Supabase free + Pinecone Starter + Gemini pay-as-you-go)

---

## Success Metrics

### Técnico
- [ ] Deploy funcional no Vercel sem erros de build
- [ ] Endpoints `draw` e `interpret` respondem corretamente em produção
- [ ] RLS do Supabase impede vazamento de dados entre usuárias
- [ ] Limite de 5 leituras/mês não pode ser burlado pelo cliente

### Produto
- [ ] Uma usuária consegue completar o fluxo completo (login → intenção → leque → revelação → leitura) sem ajuda
- [x] Interpretação em PT-BR com vocabulário esotérico e menção ao contexto de leituras anteriores (quando existente)
- [x] Retry após falha no stream funciona sem criar leitura duplicada

### Negócio
- [ ] Primeiras 10 usuárias cadastradas e com pelo menos 1 leitura realizada
- [ ] Metadata estruturada (`themes`, `journaling_note`, `next_step_advice`) coletada em 100% das leituras — base para monetização v2

---

## Open Questions

- Os 78 arquivos `.md` do `knowledge/` precisam ser criados manualmente antes do ingestion. Quem cuida disso e qual o prazo? Sem eles o RAG não funciona.
- As 78 imagens Visconti-Sforza precisam estar em `public/cards/`. Já estão disponíveis?
- Qual o critério de promoção para o plano pago (v2)? Definir agora para garantir que o schema já suporta.
