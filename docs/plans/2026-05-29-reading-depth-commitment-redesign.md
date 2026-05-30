# Mystica — Redesenho do Motor de Leitura: Profundidade + Comprometimento

**Data:** 2026-05-29
**Origem:** Clientes reclamam que a leitura é "rasa" e que "não dá previsão afirmativa do futuro".
**Contexto:** Projeto de estudo, usuárias escolhidas a dedo e cientes disso. Freio ético relaxado por consentimento informado.
**Por que isso vem antes do roadmap:** o motor de interpretação é herdado por TODAS as 14 features. Leitura rasa = Sonhos/Dupla/Retrospectiva rasos. E profundidade de leitura É o moat de marca. Consertar o motor > qualquer feature nova.

---

## Diagnóstico (a partir do `prompts.ts` atual)

São DOIS problemas com consertos distintos:

### Problema 1 — "Rasa" (genérica, efeito Barnum)
Causas no prompt atual:
- `ESTRUTURA: 1. Abra com entrada curta` → brevidade pedida explicitamente.
- Prompt do usuário é só `"Dê o seu diagnóstico agora"` — nada força citar as palavras dela, nomear padrão oculto, ou ler cartas em combinação.
- **Consertável 100%, sem dilema ético.**

### Problema 2 — "Não dá previsão afirmativa"
Causa: comprometimento foi **removido de propósito**, sobretudo no estilo Analítica:
- `Use modo subjuntivo e probabilístico`
- `Substitua "você terá" por "o arranjo simbólico sugere um movimento em direção a..."`
- `não como bola de cristal`, `evite destino manifesto`
- Resultado: texto hesitante = lido como raso. O estilo "mais profundo" soa o mais raso.

---

## Princípio do conserto

**Profundidade e comprometimento são ortogonais ao tom.** Hoje o comprometimento ficou enredado no tom "analitica". Mover **profundidade + futuro comprometido para o BASE** (vale pra todos os estilos); estilos viram **só tom**.

### O dial de comprometimento (decisão do dono, não minha)
Há um espectro. As duas pontas úteis:

- **(a) Comprometida-mas-condicional** — tendência concreta amarrada ao comportamento dela:
  > "Do jeito que você está segurando essa conversa, isso vai bater no mesmo muro nos próximos meses — a não ser que você pare de esperar ele adivinhar o que você sente."
  Honesto (tarô lê tendência), comprometido, lê como previsão.

- **(b) Afirmativa de verdade** — o que as clientes literalmente pediram:
  > "Vem dinheiro em uns 3 meses. Ele volta. Mas não é pra você."
  Bola de cristal assumida. Num projeto de estudo com consentimento informado, é um experimento válido — e é o que a audiência pediu.

Eu (assistente) prefiro (a) por gosto de craft; isso **não** é razão pra cravar (a). O dono decide. **Opção elegante:** virar isso um dial visível pra usuária (ex.: "suave / direta / sem filtro"), o que num projeto de estudo é perfeito — consentimento + você coleta dado de qual elas escolhem.

> **DECISÃO (2026-05-29): (b) afirmativa de verdade.** As clientes pediram explicitamente; é projeto de estudo com usuárias cientes. A Mystica assume a bola de cristal: afirma ("vem X", "ele volta", "vai acontecer Y") em vez de hedge. O prompt precisa **permitir e exigir** afirmação direta sobre o futuro — remover toda linguagem de subjuntivo/probabilístico de TODOS os estilos.

---

## Redesenho proposto

### BASE_SYSTEM_PROMPT — nova estrutura (força profundidade)
1. **O retrato** — descreva a situação específica DELA, nas palavras dela. (Mata Barnum: precisa ser sobre a pergunta dela, não genérico.)
2. **O que as cartas mostram** — leia as cartas em *interação*, não horóscopo carta-a-carta; conecte à situação.
3. **O padrão oculto** — nomeie o que ela NÃO está vendo, a dinâmica real por baixo. (É isto que faz parecer "profundo".)
4. **Pra onde isso caminha** — trajetória comprometida via determinismo condicional: "do jeito que está → X; se mudar Y → Z", com janela de tempo aproximada quando as cartas sustentarem. (Responde ao "quero previsão".)
5. **O que fazer** — passo prático e específico.

### Regras novas no BASE
- Seja concreta e específica à pergunta dela; proibido frase que serve pra qualquer pessoa.
- Comprometa-se com uma direção. **Proibido**: "talvez", "pode ser que", "o universo sugere", mush evasivo. **Permitido**: condicional comprometido ("vai…", "tende a…", "a não ser que…").
- Cite as palavras reais da consulente.
- Dê espaço ao texto; cada seção precisa entregar conteúdo (sem "entrada curta").

### Estilos viram só TOM (remover o anti-comprometimento)
- **Sincera**: atrito, humor, bronca afetuosa — agora também profunda e comprometida.
- **Acolhedora**: amparo emocional — agora também profunda e comprometida.
- **Analítica**: lente junguiana como *ferramenta de profundidade* (nomear padrão/sombra), **não** como desculpa pra hedge. Remover as linhas de subjuntivo/probabilístico/"não bola de cristal".

### Piso ético (sobrevive mesmo a projeto de estudo)
Não fazer afirmação determinística sobre: **saúde/doença/morte/automutilação**, e **ruína financeira/legal grave** apresentada como certeza. Nesses domínios: redirecionar pra profissional — mas em tom firme, não mush.

---

## Custo honesto: especificidade retórica ≠ especificidade real
Forçar o prompt a "nomear o padrão oculto" e "datar a trajetória" em cima de **uma pergunta de uma linha + 3 cartas aleatórias** faz o modelo **inventar** o padrão e a data. Fica mais confiante, não mais verdadeiro — é **confabulação confiante**. O prompt adiciona especificidade *retórica*; só **mais input** adiciona especificidade *informacional* real. Por isso a intuição das clientes ("perguntas mais extensas") está certa pro problema delas — e é a única alavanca que torna a leitura genuinamente sobre elas, não só com som de profunda.

Decisão de estudo embutida aqui: você quer medir *"confabulação confiante satisfaz?"* ou *"contexto real satisfaz?"* — são experimentos diferentes.

## Alavancas
1. **Reescrever o prompt (base + estilos)** — custo trivial, zero infra. Maior ganho de *profundidade percebida*. Faz primeiro. (Mas: ganho retórico, ver custo acima.)
2. **Enriquecer input sem fricção** — não exigir redação. Chips de contexto (roadmap 2.1) + 1-2 toques opcionais. **Única alavanca de especificidade real.** Sobe junto com a #1.
3. **(Futuro) Profundidade multi-turno** — 1 follow-up à leitura em vez de one-shot. Aprofunda de verdade; mais trabalho.

## Ângulo de estudo
Duas perguntas de pesquisa possíveis, e o dial (a)/(b) decide qual você roda:
- **"As usuárias preferem comprometido ao hedge?"** (qualquer ponta serve.)
- **"Confabulação confiante satisfaz tanto quanto contexto real?"** (alavanca #1 vs #2.)
Ambas transformam o moat-de-marca em experimento mensurável. Nenhuma é "chata" — a escolha é do dono.
