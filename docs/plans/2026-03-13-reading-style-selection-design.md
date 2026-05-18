# Reading Style Selection Design

## Objective

Improve the reading flow so users can explicitly choose how Mystica delivers the truth, while keeping Mystica's core identity intact and making the main CTA labels more self-explanatory.

## Approved Scope

- Add a required `Estilo da leitura` selection to the new reading flow before card selection.
- Provide exactly three styles:
  - `Sincera`
  - `Acolhedora`
  - `Analítica`
- Require the user to choose a style explicitly. No default selection.
- Persist the selected style on each reading record.
- Use the saved style when generating or regenerating the interpretation.
- Show the selected style in the history UI for transparency.
- Rename the main reading-flow buttons to clearer, more self-explanatory labels.
- Keep the `Analítica` style grounded in Jungian interpretation. The supporting Jung markdown content will be authored separately by the user.

## Product Rules

- Mystica's identity is fixed: she is always sincere, direct, and does not sugarcoat the message.
- The selected style changes how the truth is delivered, not who Mystica is.
- The UX should minimize interpretation effort from the user:
  - the selector label must be self-explanatory
  - option names must be easy to scan
  - supporting text should describe the outcome for the user, not theory

## Style Definitions

### Sincera

- Truth delivered with friction, humor, spiritual "bronca", and pragmatic direction.
- The charm comes from the archetype of the aunt who scolds with affection.
- The verbal jab must target behavior or the current situation, not the user's identity.
- Allowed vocabulary direction includes terms like `tola`, `doidal`, `trouxa`, `sonsa`, `parada`, `devagar`.
- The insult only works when paired with context, humor, and a solution.
- Every sharper line should be followed by diagnosis and practical next steps.

### Acolhedora

- Still honest, but softer and more emotionally protective.
- Uses less abrasion and more emotional support.
- Must not drift into generic coaching language or vague affirmation.

### Analítica

- Still honest, but deeper and more reflective.
- Focuses on patterns, emotions, self-knowledge, and symbolic interpretation.
- Uses a Jungian lens: archetypes, shadow, individuation, and meaningful inner patterns.
- Should sound insightful, not academic or lecture-like.

## UX Copy

### Selector

- Label: `Estilo da leitura`

### Option subtitles

- `Sincera`: `Verdade nua e crua, sem enrolação.`
- `Acolhedora`: `Verdade com mais cuidado e acolhimento.`
- `Analítica`: `Verdade com leitura profunda de padrões, emoções e autoconhecimento.`

### Button labels

- `Concentrar` -> `Continuar para escolher as cartas`
- `Voltar e ajustar pergunta` -> `Voltar e editar minha pergunta`
- `Nova tiragem` -> `Fazer nova leitura`
- `Tentar novamente` -> `Gerar interpretação novamente`

## Data and Behavior

- Add a new reading-level field to persist the selected style.
- Readings created before this feature should fall back to `Sincera`.
- The style value must be included in:
  - draw request validation
  - reading persistence
  - reading fetch APIs
  - interpretation prompt construction
  - history UI rendering
  - reading detail UI where relevant

## Prompt Design Constraints

- `Sincera` keeps the friction and the scolding tone as part of Mystica's brand.
- `Sincera` must avoid humiliating or dehumanizing statements about the user's worth.
- `Acolhedora` keeps honesty but reduces sting.
- `Analítica` should use the Jung material as interpretive grounding, not as academic exposition.
- Regenerated interpretations must reuse the saved style so the voice remains consistent.

## Implementation Notes

- Update the new reading screen in [page.tsx](/C:/Users/breno/Documents/projects/Mystica/src/app/reading/page.tsx) to collect the style before advancing.
- Update the draw route in [route.ts](/C:/Users/breno/Documents/projects/Mystica/src/app/api/reading/draw/route.ts) to validate and persist the selected style.
- Update reading fetch and interpret routes in [route.ts](/C:/Users/breno/Documents/projects/Mystica/src/app/api/reading/[id]/route.ts) and [route.ts](/C:/Users/breno/Documents/projects/Mystica/src/app/api/reading/[id]/interpret/route.ts) to return and use the style.
- Refactor prompt construction in [prompts.ts](/C:/Users/breno/Documents/projects/Mystica/src/lib/prompts.ts) so the base Mystica identity stays fixed and the style becomes an explicit variant.
- Update the history list in [sections.tsx](/C:/Users/breno/Documents/projects/Mystica/src/app/history/sections.tsx) to show the chosen style.
- Cover the flow with targeted tests for UI validation, persistence, fallback behavior, and prompt selection.
