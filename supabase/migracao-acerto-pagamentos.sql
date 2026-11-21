-- ===== Rode UMA vez no SQL Editor do Supabase =====
-- Guarda os pagamentos feitos no "Acerto do mês" (quem já pagou quanto), para o saldo devedor ir diminuindo.
create table public.acerto_pagamentos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas(id) on delete cascade,
  mes text not null,
  de_user uuid not null references auth.users(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
alter table public.acerto_pagamentos enable row level security;
create policy acerto_pag_ver on public.acerto_pagamentos for select using (casa_id = public.minha_casa());
create policy acerto_pag_criar on public.acerto_pagamentos for insert
  with check (casa_id = public.minha_casa() and de_user in (select user_id from public.casa_membros where casa_id = public.minha_casa()));
create policy acerto_pag_apagar on public.acerto_pagamentos for delete using (casa_id = public.minha_casa());
