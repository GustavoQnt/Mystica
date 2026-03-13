# Mystica — Design Spec
**Data:** 2026-03-12
**Status:** Aprovado

---

## Visão do Produto

Mystica é um SaaS de leituras de tarot potencializado por IA, focado no mercado brasileiro. A proposta central é transformar uma consulta isolada em uma **jornada terapêutica contínua** — a usuária sente que Mystica a conhece, não que está falando com um chatbot genérico.

### Usuária-alvo
Mulher brasileira, com afinidade com tarot, que quer uma consulta rápida e acessível sem precisar de um tarólogo. Não é iniciante, mas também não é praticante técnica — quer profundidade com praticidade.

### Diferenciais
1. **Aleatoriedade real e percebida**: o sorteio é um evento técnico separado da interpretação. A usuária escolhe cartas do leque — ela sente que a mão foi guiada pela intuição, não que a IA inventou as cartas na hora.
2. **Journaling sistêmico**: o contexto das últimas leituras é injetado no prompt, criando a sensação de que Mystica conhece a trajetória da usuária. Uma tiragem isolada vira uma jornada.

---

## Identidade Visual

- **Estilo**: Dark Mystical — roxo profundo (`#0d0d1a`, `#1a0a2e`, `#2d1b4e`), dourado (`#c9a96e`), tipografia serifada
- **Baralho**: Visconti-Sforza (séc. XV) — imagens reais em `webp/avif`, nome da carta abaixo. Domínio público, altíssima percepção de valor.
- **Tom de voz**: taróloga brasileira experiente. Usa o vocabulário do esoterismo nacional: *axé*, *caminhos abertos*, *limpeza energética*, *amarração emocional*. Direta, empática, nunca suaviza demais.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 (App Router) |
| Hosting | Vercel (Hobby free tier) |
| Auth + DB | Supabase (PostgreSQL + Auth) |
| Vector DB | Pinecone Starter (free) |
| LLM | Gemini 2.0 Flash |
| Imagens das cartas | `public/cards/` (webp/avif) |
| Embeddings | `text-embedding-004` (Google) |

---

## Arquitetura

```
Usuária (browser)
     │
     ▼
Next.js App (Vercel)
├── /app                     → UI (Dark Mystical, animações)
├── /app/api/reading/draw    → POST: sela cartas no Supabase
├── /app/api/reading/[id]/interpret → POST: RAG + Gemini streaming
├── /app/api/history         → GET: histórico da usuária
     │
     ├──→ Supabase (Postgres + Auth)
     │       ├── users         (via Supabase Auth — Google + email)
     │       └── readings      (tiragem, cartas, interpretação, metadata)
     │
     ├──→ Pinecone
     │       └── índice vetorial (78 cartas + spreads + contextos PT-BR)
     │
     └──→ Gemini API
             ├── Call 1: streaming narrativo (interpretação completa)
             └── Call 2: JSON mode extração de metadata
```

---

## Auth Flow

- Supabase Auth com Google OAuth + magic link (email)
- Rota `/login` pública — mostra landing page com CTA "Consultar agora"
- Unauthenticated: pode ver a landing, mas ao clicar em "Nova Tiragem" é redirecionada para `/login`
- Após login, Supabase cria `auth.users` automaticamente; trigger cria `profiles` com `plan: 'free'`
- Rotas `(auth)/` protegidas via middleware Next.js — redirect para `/login` se sem sessão
- Callback OAuth: `/auth/callback` (rota pública, Next.js handler padrão do Supabase)

---

## Fluxo da Usuária (5 telas)

### ① Home
- Widget **"Seu Conselho de Hoje"** — exibe `next_step_advice` da última leitura sem nova chamada de API
- Mini-histórico das últimas tiragens (cartas em thumbnail)
- Botão "Nova Tiragem"

### ② Intenção
- Campo de texto: "Qual é a sua intenção?" — escreve a pergunta
- Seleção do tipo de tiragem: **3 cartas** | **Carta do Dia**
- Botão "Concentrar →"

### ③ Leque
- Baralho completo em leque animado
- Usuária toca nas cartas para escolher (1 a 3 dependendo da tiragem)
- **Cada escolha é salva imediatamente via `POST /api/reading/draw`** — idempotência garantida
- Progress bar: "2 de 3 cartas escolhidas"

### ④ Revelação + Streaming
- Cartas viradas com imagem real (Visconti-Sforza) + nome + posição
- Texto da interpretação aparece em streaming (efeito de digitação)
- "Mystica está lendo as cartas..." enquanto aguarda

### ⑤ Leitura completa
- Texto narrativo completo
- **Conselho Prático** destacado (do `next_step_advice`): ação + timing
- Botão salvar / compartilhar

---

## Data Model

```sql
-- Perfil da usuária (extensão do auth.users do Supabase)
profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  plan                text NOT NULL DEFAULT 'free',   -- 'free' | 'paid'
  readings_this_month int NOT NULL DEFAULT 0,
  month_cycle         text NOT NULL DEFAULT '',       -- ex: '2026-03' (YYYY-MM)
  updated_at          timestamptz DEFAULT now()
)

-- RLS: usuária só acessa o próprio perfil
-- Reset lazy (compatível com Supabase free tier — sem pg_cron):
-- Em POST /api/reading/draw, antes de verificar o limite:
--   currentCycle = format(now(), 'YYYY-MM')
--   if profiles.month_cycle != currentCycle:
--     UPDATE profiles SET readings_this_month=0, month_cycle=currentCycle
-- Assim o contador reseta automaticamente na primeira leitura de cada mês.

readings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users NOT NULL,
  status       text NOT NULL,      -- 'drawn' | 'completed' | 'failed'
  spread_type  text NOT NULL,      -- 'tres-cartas' | 'carta-do-dia'
  question     text,
  card_ids     int[] NOT NULL,     -- ex: [16, 18, 19] — sorteados server-side
  -- positions derivadas do spread_type, não armazenadas separadamente:
  -- 'tres-cartas'  → ["passado", "presente", "futuro"]
  -- 'carta-do-dia' → ["presente"]
  interpretation text,             -- texto completo da leitura
  metadata     jsonb,              -- estrutura abaixo
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
)

-- RLS: usuária só acessa as próprias leituras
```

---

## API Endpoints

### `POST /api/reading/draw`
Sela as cartas **server-side** antes do Gemini. O cliente envia apenas os **índices do leque** escolhidos pela usuária, não os IDs das cartas. O servidor resolve os IDs a partir de um baralho embaralhado gerado no momento do request (seed descartável — apenas os IDs resultantes são persistidos).

```ts
body: { spread_type: 'tres-cartas' | 'carta-do-dia', fan_indices: number[], question: string }
returns: { reading_id: string }
// card_ids NÃO são retornados aqui — o cliente os recebe somente no início do
// stream de /interpret, para evitar que o usuário inspecione a rede e conheça
// as cartas antes da animação de revelação.
errors:
  400 – fan_indices.length inválido para o spread_type
  403 – usuária atingiu limite do plano free (5 leituras/mês)
  500 – erro ao salvar no Supabase
```

### `POST /api/reading/[id]/interpret`
Busca a leitura pelo ID (deve estar em status `'drawn'`). Roda RAG orchestration e faz streaming da interpretação. Idempotente: se status já for `'completed'`, retorna a interpretação existente sem chamar o Gemini novamente.

```ts
returns: ReadableStream (texto da interpretação)
errors:
  404 – reading_id não encontrado ou não pertence à usuária
  409 – status não é 'drawn' nem 'completed'
  500 – erro no Gemini (seta status='failed'; cliente pode retry)

// Falha no meio do stream:
// - status setado para 'failed', interpretation parcial descartada
// - cliente recebe sinal de erro via stream
// - retry em /interpret detecta status='failed', reseta para 'drawn' e recomeça
```

---

## RAG Orchestration (Hybrid Search)

```
Cartas sorteadas: [A Torre (16), A Lua (18), O Sol (19)]
Pergunta: "meu relacionamento tem futuro?"
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   PINECONE                 SUPABASE
(conhecimento)            (memória pessoal)
        │                       │
Query 1: filter card_id IN      Últimas 3 leituras →
[16, 18, 19] → significados     extrair themes +
canônicos das cartas            journaling_note
        │                       │
Query 2: semantic search        Injetar como 1-2
"relacionamento futuro amor"    linhas de contexto
→ contextos + combinações       no prompt
        │                       │
        └───────────┬───────────┘
                    ▼
             PROMPT MONTADO
```

**Por que Hybrid Search:** RAG puramente semântico em Tarot é perigoso — A Torre e A Estrela podem ter vetores próximos por sentimento, mas significados opostos. O filtro por `card_id` garante que o significado canônico de cada carta sorteada **sempre** aparece no contexto. A busca semântica complementa com combinações e contextos temáticos.

---

## Gemini Pattern (Token-Efficient)

### Call 1 — Streaming narrativo (~4k tokens de input)
```
system: persona Mystica + vocabulário esotérico BR
context: [Pinecone chunks das cartas] + [linhas de histórico do Supabase]
user: tiragem + posições + pergunta
→ gera: texto narrativo completo (stream)
```

### Call 2 — Extração de metadata (~800 tokens de input)
```
"Dado este texto: [interpretação gerada]
Extraia os metadados no seguinte esquema JSON:"
→ gera: responseSchema estruturado (não streaming)
```

A Call 2 não repete RAG nem histórico — só recebe o texto que a Call 1 acabou de gerar. Custo mínimo, dados estruturados máximos.

### ResponseSchema

```json
{
  "themes": ["transformação", "caminhos abertos"],
  "energy": "renovação após crise",
  "cards_summary": [
    { "card_id": 16, "keyword": "ruptura necessária", "position_index": 0 }
  ],
  // position_index referencia a posição no array card_ids do reading
  // label é derivado do spread_type: tres-cartas[0]="passado", [1]="presente", [2]="futuro"
  "journaling_note": "A Torre apareceu pela segunda vez em contexto de relacionamento",
  "next_step_advice": {
    "action": "Acenda uma vela roxa e escreva o que precisa ser dito",
    "why": "A Lua pede que o não-dito venha à tona antes do Sol poder brilhar",
    "timing": "nos próximos 3 dias"
  }
}
```

---

## Context Injection (Journaling MVP)

No MVP, o journaling é implementado como **context injection simples**:

```
// No prompt da Call 1, injetar:
"[MEMÓRIA DA USUÁRIA]
Semana passada: A Torre saiu quando você falou sobre incerteza no trabalho.
Hoje A Torre aparece novamente, sobre relacionamento — padrão de ruptura recorrente.
Se houver conexão com a tiragem atual, mencione com delicadeza."
```

**Como é gerado:**
1. `SELECT card_ids, metadata->>'journaling_note', created_at FROM readings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3`
2. Formatar como 1-3 linhas de contexto
3. Injetar no prompt antes da tiragem atual

**Caminho para v2:** os campos `themes`, `journaling_note` e `energy` já estão sendo coletados desde o primeiro dia. O v2 usa esses dados estruturados para RAG avançado — embedding dos `journaling_notes` no Pinecone por usuário, análise de padrões de médio prazo.

---

## Monetização (Freemium)

- **Plano gratuito**: **5 leituras/mês** — contador em `profiles.readings_this_month`, resetado lazily via `month_cycle` na primeira leitura de cada mês (compatível com Supabase free tier)
- **Plano pago** (v2): leituras ilimitadas + tiragens avançadas (Cruz Celta etc.) + histórico completo
- Enforcement: `POST /api/reading/draw` verifica `profiles.readings_this_month >= 5` e retorna `403` se `plan = 'free'`
- Integração de pagamento: **v2** (Stripe ou Mercado Pago)

---

## Pinecone — Ingestion Spec

### Volume esperado
- 78 cartas × ~3 chunks/carta = ~234 vetores de conhecimento base
- + ~20 vetores de spreads, simbolismo e contextos
- **Total MVP: ~260 vetores** — bem dentro do free tier do Pinecone

### Estrutura dos arquivos `.md`
Cada carta tem um arquivo em `knowledge/arcanos-maiores/` ou `knowledge/arcanos-menores/[naipe]/`:
```
# A Torre (XVI)
card_id: 16

## Significado geral
...

## Posição normal
...

## Invertida
...

## Contextos
### Amor
### Carreira
### Saúde

## Combinações notáveis
...
```

### Chunking
- Chunk por seção (`## Heading`) — cada seção vira um vetor independente
- Tamanho alvo: 400–700 tokens por chunk
- **Metadata obrigatória por chunk**: `{ card_id, card_name, section, suit, arcana_type }`
- `card_id` é o campo usado no filtro híbrido do Pinecone

### Script `scripts/ingest.ts`
1. Lê todos os `.md` de `knowledge/`
2. Extrai metadata do frontmatter + nome do arquivo
3. Chunka por seção com overlap mínimo
4. Gera embeddings via `text-embedding-004`
5. Upsert no Pinecone com metadata filtráveis
6. Idempotente: usa `card_id + section` como ID do vetor

### Responsabilidade do conteúdo
Os 78 arquivos `.md` das cartas são uma dependência de pré-lançamento. Devem ser criados manualmente (curadoria) com terminologia brasileira + referências a axé, caminhos abertos etc. Sem esses arquivos, o RAG não funciona.

---

## MVP — Escopo

### Incluído
- [x] Autenticação (Google + email via Supabase Auth)
- [x] Tiragem de 3 cartas (passado / presente / futuro)
- [x] Carta do Dia (1 carta)
- [x] Pergunta personalizada
- [x] Leque animado (sorteio visual)
- [x] Streaming da interpretação
- [x] Conselho prático (`next_step_advice`)
- [x] Histórico de leituras
- [x] Context injection (journaling básico)
- [x] Widget "Conselho de Hoje" na Home

### Fora do MVP (v2)
- [ ] Cruz Celta e tiragens complexas
- [ ] RAG avançado por usuário (embedding do histórico pessoal)
- [ ] Chat contínuo sobre a leitura
- [ ] Notificações push (carta do dia)
- [ ] Compartilhamento de leituras
- [ ] Pagamentos e plano pago
- [ ] Gemini Context Caching para o corpus das 78 cartas

---

## Custos Estimados (MVP)

| Serviço | Plano | Custo/mês |
|---|---|---|
| Vercel | Hobby (grátis) | $0 |
| Supabase | Free tier (500MB, 50k usuários auth) | $0 |
| Pinecone | Starter (grátis, 1 índice) | $0 |
| Gemini API | Pay-as-you-go (~2 calls/leitura) | ~$2–15 |
| **Total** | | **$2–15/mês** |

---

## Estrutura de Ficheiros

```
mystica/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── reading/        # Fluxo completo (intenção → leque → leitura)
│   │   │   ├── history/        # Histórico de leituras
│   │   │   └── profile/
│   │   ├── api/
│   │   │   ├── reading/
│   │   │   │   ├── draw/       # POST: sela cartas
│   │   │   │   └── [id]/
│   │   │   │       └── interpret/ # POST: RAG + Gemini stream
│   │   │   └── history/        # GET: leituras da usuária
│   │   ├── layout.tsx
│   │   └── page.tsx            # Landing / Home com widget
│   ├── lib/
│   │   ├── pinecone.ts         # Cliente + hybrid search
│   │   ├── gemini.ts           # Call 1 (stream) + Call 2 (JSON mode)
│   │   ├── rag.ts              # Orquestração RAG completa
│   │   ├── context-injection.ts # Busca + formata histórico da usuária
│   │   ├── tarot.ts            # Dados das 78 cartas, sorteio
│   │   └── prompts.ts          # Templates de prompt PT-BR
│   └── components/
│       ├── CardFan.tsx         # Leque animado
│       ├── CardReveal.tsx      # Animação de virar carta
│       ├── ReadingStream.tsx   # Texto em streaming
│       ├── NextStepAdvice.tsx  # Widget conselho prático
│       └── TodaysAdvice.tsx    # Widget home "Conselho de Hoje"
├── knowledge/                  # Base de conhecimento RAG (PT-BR)
│   ├── arcanos-maiores/        # 22 cartas .md
│   ├── arcanos-menores/        # 56 cartas .md
│   ├── spreads/
│   ├── simbolismo/
│   └── contextos/              # amor, carreira, saúde, espiritualidade
├── scripts/
│   └── ingest.ts               # Indexação no Pinecone
└── public/
    └── cards/                  # 78 imagens Visconti-Sforza (.webp)
```
