alter table public.readings
add column reading_style text
check (reading_style in ('sincera', 'acolhedora', 'analitica'));
