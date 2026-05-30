-- "Mystica pergunta": stores the encrypted envelope of the probe Q&A
-- (clarifying questions Mystica asked about the spread + the querent's answers).
-- TEXT, not JSONB, because the value is an encrypted string (same pattern as
-- readings.question / readings.interpretation).
alter table public.readings
add column extra_context text;
