# 🔮 Mystica — Roadmap de Features

---

## Mapa Astral e Astrologia

### Mapa natal
Cálculo de ascendente, casas e planetas em signo com base em data, hora e local de nascimento. A base técnica já existe (RAG + Pinecone + Gemini) — só é necessário integrar uma biblioteca de ephemeris (ex: `astronomia` ou chamada à Swiss Ephemeris API) para calcular as posições planetárias. A Mystica interpreta o resultado com o mesmo pipeline de prompt atual.

### Trânsitos e previsões
Cruzamento do mapa natal do usuário com as posições planetárias do dia. Driver de retenção: o usuário volta diariamente para ver o que os planetas estão fazendo na sua carta.

### Sinastria
Compatibilidade entre dois mapas natais. Produto natural para casais e amizades. Requer armazenar o segundo mapa no Supabase e gerar um prompt comparativo.

---

## Signo e Horóscopo

### Horóscopo diário com IA
Gerado pela Mystica com base no mapa do usuário — não um horóscopo genérico de revista. Diferencial enorme de percepção de valor. Pode ser entregue via push notification diária e servir como gancho para upsell do plano premium.

### Tríade Solar / Lunar / Ascendente
Leitura integrada dos três eixos astrológicos do usuário. Mais profunda que "qual é o seu signo", mais acessível que o mapa natal completo. Bom produto de entrada para o segmento de astrologia.

### Tarot por signo
Tiragem adaptada ao tema do momento astrológico do signo do usuário. Une os dois sistemas (Tarot + astrologia) de forma natural, sem exigir um mapa natal completo.

---

## Oráculos Complementares

### Numerologia do nome e data
Cálculo de número de vida, caminho e expressão a partir do nome completo e data de nascimento. Sistemas divinatórios complementares que se encaixam no mesmo pipeline de RAG + LLM existente. Amplia o público sem contradizer o posicionamento da Mystica.

### I Ching interativo
Hexagrama gerado a partir de uma animação de "jogar moedas" virtuais. Diferencial visual e de UX. O I Ching tem 64 hexagramas com interpretações ricas — excelente candidato para ingestão no Pinecone.

### Leitura de sonhos
O usuário descreve um sonho e a Mystica interpreta com simbologia esotérica, arquétipos e significados ocultos. Zero dependência externa — reutiliza o pipeline de RAG + LLM existente. Feature altamente compartilhável e com apelo emocional forte.

### Leitura por momento
Em vez de perguntar "qual sua dúvida?", oferecer contextos prontos: "amor", "trabalho", "saúde", "decisão", "autoconhecimento". Reduz fricção de entrada e melhora a qualidade do prompt enviado ao LLM, gerando interpretações mais direcionadas.

---

## Conteúdo e Educação

### Escola mística
Mini-aulas sobre o significado de cada carta, arcanos maiores vs menores, naipes e como fazer sua própria tiragem. Transforma o app de "consulta" em "aprendizado", aumenta tempo de sessão e retenção. Conteúdo pode ser gerado via LLM e curado manualmente.

### Glossário esotérico interativo
Termos como "casa 7", "Mercúrio retrógrado", "número de expressão" linkados dentro das leituras. O usuário toca e aprende sem sair do contexto da tiragem. Melhora compreensão e percepção de profundidade do app.

---

## Temporal e Sazonalidade

### Calendário místico
Marcação de datas relevantes: eclipses, Mercúrio retrógrado, solstícios, luas cheias/novas, portais numerológicos (11/11, 22/02). Conteúdo especial nesses dias cria hábito de abrir o app em momentos-chave do calendário esotérico.

### Leitura de ano pessoal
Tiragem especial de virada de ano (aniversário ou Ano Novo) com previsão dos 12 meses. Feature sazonal com alto valor percebido — candidata natural para plano premium ou compra avulsa.

---

## Personalização e Identidade

### Perfil místico
Compilação de signo solar + número de vida + carta pessoal do Tarot (baseada na data de nascimento) numa "identidade mística" do usuário. Serve como contexto persistente para todas as leituras futuras ficarem mais personalizadas e profundas.

### Lua e energia do dia
Banner no home mostrando fase da lua, elemento do dia, cor de sorte e energia predominante. Conteúdo leve que dá vida ao app mesmo sem o usuário fazer uma tiragem. Custo técnico baixo (API de fases lunares ou cálculo local).

---

## Retenção e Engagement

### Diário espiritual
Registro de leituras com campo de reflexão pessoal. O usuário anota o que a leitura significou para ele, criando um histórico emocional que a Mystica pode usar como contexto em tiragens futuras (já contemplado na arquitetura de memória do Supabase).

### Carta do dia + streak
Uma leitura de 1 carta por dia, notificação push e sequência de dias ativos. A mecânica do Duolingo aplicada ao esotérico. Custo de implementação baixo, impacto em DAU alto. É a feature de menor esforço e maior retorno de engajamento.

### Ritual do dia
Sugestão diária de ritual simples (meditação, cristal, mantra, banho de ervas) baseado na fase da lua ou momento astrológico. Complementa a carta do dia como conteúdo de retorno diário e reforça o posicionamento místico da plataforma.

### Leitura em dupla
Uma pessoa faz uma pergunta sobre a relação com outra — uma sinastria simplificada via Tarot, sem exigir mapa natal completo. Produto natural para casais, amizades e relações familiares. Potencial de viralização por convidar a segunda pessoa.

### Retrospectiva mística
Resumo semanal ou mensal das leituras do usuário: temas recorrentes, cartas que mais apareceram, evolução emocional ao longo do tempo. Aproveita o histórico já armazenado no Supabase para gerar insights personalizados via LLM.

---

## Gamificação

### Coleção de cartas
Cada tiragem "desbloqueia" a carta no acervo pessoal do usuário. Completar todos os 78 arcanos vira uma conquista. Mecânica de colecionismo que incentiva uso recorrente e exploração de diferentes tipos de tiragem.

### Conquistas místicas
Badges por marcos: "Primeira tiragem", "7 dias de streak", "Explorou todos os naipes", "Primeira leitura de sonho", "78 cartas coletadas". Reforça engajamento com custo técnico baixo — armazenamento simples no Supabase.

---

## Social e Crescimento

### Compartilhar leitura como card
Geração de um card visual (imagem) da tiragem para compartilhar no Instagram, WhatsApp e redes sociais. Motor de viralização orgânica com custo baixo (canvas/SVG server-side). Cada compartilhamento é marketing gratuito para a Mystica.

---

## Imersão e Experiência

### Modo meditação pré-leitura
30-60 segundos de respiração guiada com visual e som ambiente antes da tiragem. Aumenta o valor percebido da leitura e diferencia a Mystica de apps genéricos de tarot. Candidato para feature premium.

### Ambientação sonora
Sons de fundo temáticos durante a leitura — natureza, sinos tibetanos, fogo crepitando, chuva. Cria atmosfera imersiva que transforma a experiência de "usar um app" em um momento de conexão espiritual.

---

## Técnico (Alto Impacto)

### Multi-LLM com fallback (Gemini + Claude)
Arquitetura de `LLMRouter` que tenta o Gemini primeiro e faz fallback automático para o Claude (Anthropic) em caso de erro ou timeout. O SSE pipeline e o cliente não mudam. Resolve o ponto único de falha atual e aumenta a resiliência do produto.

**Stack**: `GeminiProvider` + `ClaudeProvider` implementando interface comum `LLMProvider`. Router com `Promise.race` e timeout configurável por ambiente.

### Leitura por voz (TTS)
A Mystica lê a tiragem em voz alta usando Text-to-Speech. Entrega via SSE de áudio (ex: ElevenLabs ou Google TTS). Diferencial forte de imersão, especialmente em mobile. Candidato natural para feature exclusiva do plano premium.

---

## Monetização

### Planos por camada
Estrutura sugerida:

| Plano | Recursos |
|-------|----------|
| **Free** | X leituras/mês, Tarot básico |
| **Mystica+** | Leituras ilimitadas, carta do dia, I Ching, Numerologia |
| **Astral** | Tudo do Mystica+ + mapa natal, trânsitos, sinastria |

### Consulta com especialista
Upsell de sessão ao vivo com uma taróloga ou astróloga real. A IA serve como produto de entrada; a consulta humana é o ticket premium. Modelo de marketplace leve — a Mystica conecta, não hospeda.

---

## Prioridade sugerida

1. **Carta do dia + streak** — menor esforço, maior impacto em retenção
2. **Leitura por momento** — reduz fricção, melhora qualidade das leituras
3. **Compartilhar leitura como card** — motor de crescimento orgânico, custo baixo
4. **Coleção de cartas + Conquistas** — gamificação que incentiva uso recorrente
5. **Horóscopo diário com IA** — driver de retorno diário, base para upsell
6. **Leitura de sonhos** — reutiliza pipeline existente, apelo emocional forte
7. **Perfil místico + Lua e energia do dia** — personalização e vida ao home
8. **Retrospectiva mística** — aproveita dados existentes, gera insights
9. **Numerologia** — cálculo algorítmico simples, expande público
10. **Escola mística + Glossário** — conteúdo educativo, aumenta tempo de sessão
11. **Calendário místico + Leitura de ano pessoal** — sazonalidade e retenção
12. **Mapa natal** — feature âncora do plano Astral
13. **I Ching interativo** — expansão de público com baixo custo técnico
14. **Ritual do dia + Ambientação sonora** — imersão e diferenciação