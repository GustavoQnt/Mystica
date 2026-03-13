# 🔮 Mystica

Mystica é uma aplicação SaaS avançada de Tarot interativo. Ela mistura a sabedoria ancestral das cartas com tecnologia moderna para fornecer leituras personalizadas, diretas e profundamente espirituais. O aplicativo foi projetado não apenas como um serviço esotérico, mas como uma plataforma técnica resiliente e otimizada (SaaS architecture).

## ✨ Principais Funcionalidades

- **Leituras Autênticas de Tarô:** Tiragens de 1 a 3 cartas (Passado, Presente e Futuro).
- **Inteligência Artificial (Persona "Mystica"):** Alimentada pelo Google Gemini, estruturada através de RAG (Retrieval-Augmented Generation) com uma vasta base de conhecimento do Tarô e programada para ter uma personalidade forte, sincera e "ácida" com diretrizes *Anti-Leak* rígidas.
- **Transmissão em Tempo Real (Streaming):** Textos interpretados enviados ao usuário via Server-Sent Events (SSE) gerando uma sensação conversacional fluida.
- **Histórico e Memória Contextual:** Entendimento do histórico espiritual do usuário salvo no banco de dados para evitar leituras repetitivas ou contraditórias.
- **Planos e Limites:** Sistema dinâmico de limitação (Business limit com "X" leituras gratuitas por mês).
- **Proteção Anti-DDoS:** Rate Limits configurados no Upstash (Redis) para barrar ataques de bots utilizando a técnica de *Sliding Window*.

---

## 🛠️ Stack Tecnológica

O Mystica utiliza as tecnologias e bibliotecas mais recentes em seu core:

- **Framework Front-end:** [Next.js 16](https://nextjs.org) (App Router, Server Actions, Server Components)
- **Biblioteca UI:** [React 19](https://react.dev)
- **Estilização:** [Tailwind CSS v4](https://tailwindcss.com) com variáveis e customizações complexas direto no arquivo `globals.css`.
- **Banco de Dados e Auth:** [Supabase](https://supabase.com) (Auth + Row Level Security, PostgreSQL)
- **Inteligência Artificial:** [Google Gemini](https://ai.google.dev/) via `@google/generative-ai`
- **Banco de Dados Vetorial (RAG):** [Pinecone](https://pinecone.io)
- **Rate Limiting:** [Upstash Redis](https://upstash.com/)
- **Imagens:** Otimização agressiva com elementos `<picture>` carregando WebP/AVIF.
- **Ecosystem Tooling:** ESLint, Prettier, TypeScript e Vitest para testes.

---

## ⚙️ Arquitetura e Fluxo de Dados (RAG & Streaming)

1. **Ação do Usuário:** O usuário envia uma nova pergunta e seleciona as cartas usando uma UI baseada em física de cartas visuais.
2. **Rota de Autenticação & Rate Limit (`POST /api/reading/[id]/interpret`):** Verifica os cookies de sessão com `Supabase` e garante a validade do token. O Upstash atua como *shield* técnico abortando excessos instantaneamente com o Status HTTP 429.
3. **Indexação RAG:** As cartas sorteadas passam por uma busca no banco vetorial Pinecone para puxar contexto avançado, histórico do usuário e referências esotéricas (Contexto RAG).
4. **Requisição LLM:** O `Prompt final` consolida a Persona Mystica + Contexto RAG + Pergunta feita, enviando esses parâmetros para o Gemini.
5. **Streaming (SSE):** O retorno é mapeado num `ReadableStream` que utiliza `TextEncoder` customizado para desenhar o texto progressivamente na tela do usuário simulando uma leitura psíquica ao vivo.
6. **Background Task:** Metadados, resumos gerados e a leitura integral descida são salvos e limpos no Supabase para montar o *Histórico do Usuário* de forma assíncrona.

---

## 🔒 Segurança e Resiliência

- O modelo é blindado por instâncias de **Negative Constraints**. Qualquer tentativa de perguntar *quem a Mystica é* ou *de onde ela surgiu*, será respondida exclusivamente com "Sou Mystica, sua taróloga de confiança".
- As imagens das cartas de Tarô utilizam formatos `.avif` e `.webp` convertidas server-side para economizar banda (saindo de 4MB por tela para míseros centenas de KB's).

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 20+
- Conta no [Supabase](https://supabase.com)
- Conta no [Pinecone](https://pinecone.io)
- [Gemini API Key](https://aistudio.google.com/app/apikey)
- Conta no [Upstash](https://upstash.com/) (Redis)

### Configuração do Ambiente

Crie um arquivo `.env.local` na raiz contendo:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# Pinecone
PINECONE_API_KEY=YOUR_PINECONE_API_KEY
PINECONE_INDEX_NAME=mystica-tarot

# Gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

# Upstash Rate Limiting
UPSTASH_REDIS_REST_URL=YOUR_UPSTASH_URL
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN
```

### Inicializando

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Popule dados fictícios/Inicie a ingestão RAG (se tiver o banco vetorial vazio):
   ```bash
   npm run ingest
   ```

3. Inicie o servidor:
   ```bash
   npm run dev
   ```

4. Acesse o projeto em [http://localhost:3000](http://localhost:3000)

## 🧙‍♀️ "Misericórdia! Vai ler suas cartas, vai." - Mystica
