-- ============ PASSO 1: rode tudo isto no SQL Editor do Supabase ============
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text, ntfy_topic text, renda numeric default 0, metas jsonb default '{}'::jsonb
);
create table public.casa_membros (user_id uuid primary key references auth.users(id) on delete cascade);
create table public.casa_config (
  id int primary key default 1 check (id = 1),
  pagador uuid references auth.users(id), pct_pagador numeric default 50,
  renda_casa numeric default 0, metas jsonb default '{}'::jsonb
);
create table public.contas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  escopo text not null check (escopo in ('casa','pessoal')),
  descricao text, beneficiario text, categoria text default 'Outros',
  valor numeric(12,2) not null, vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente','paga')),
  pago_em date, codigo_barras text, recorrente boolean default false,
  criado_em timestamptz default now()
);
create unique index contas_barras_casa on public.contas(codigo_barras) where escopo = 'casa' and codigo_barras is not null;
create unique index contas_barras_pessoal on public.contas(dono_id, codigo_barras) where escopo = 'pessoal' and codigo_barras is not null;
create table public.regras (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave text not null, escopo text not null, categoria text,
  unique (dono_id, chave)
);
create table public.acertos (mes text primary key, feito boolean default false);

create or replace function public.eh_membro() returns boolean
language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.casa_membros where user_id = auth.uid()) $$;

create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public
as $$ begin insert into public.perfis (id, nome) values (new.id, split_part(new.email, '@', 1)); return new; end $$;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.novo_usuario();

-- Segurança: quem pode ver/alterar o quê (isto garante a privacidade entre vocês dois)
alter table public.perfis enable row level security;
alter table public.casa_membros enable row level security;
alter table public.casa_config enable row level security;
alter table public.contas enable row level security;
alter table public.regras enable row level security;
alter table public.acertos enable row level security;

create policy perfis_ver on public.perfis for select using (id = auth.uid() or (public.eh_membro() and id in (select user_id from public.casa_membros)));
create policy perfis_editar on public.perfis for update using (id = auth.uid()) with check (id = auth.uid());
create policy membros_ver on public.casa_membros for select using (public.eh_membro());
create policy config_ver on public.casa_config for select using (public.eh_membro());
create policy config_editar on public.casa_config for update using (public.eh_membro()) with check (public.eh_membro());
create policy contas_ver on public.contas for select using ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and public.eh_membro()));
create policy contas_criar on public.contas for insert with check (dono_id = auth.uid() and (escopo = 'pessoal' or (escopo = 'casa' and public.eh_membro())));
create policy contas_editar on public.contas for update using ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and public.eh_membro()))
  with check ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and public.eh_membro()));
create policy contas_apagar on public.contas for delete using ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and public.eh_membro()));
create policy regras_ver on public.regras for select using (dono_id = auth.uid() or (escopo = 'casa' and public.eh_membro()));
create policy regras_criar on public.regras for insert with check (dono_id = auth.uid());
create policy regras_editar on public.regras for update using (dono_id = auth.uid()) with check (dono_id = auth.uid());
create policy acertos_tudo on public.acertos for all using (public.eh_membro()) with check (public.eh_membro());

-- ============ PASSO 2: DEPOIS de criar os 2 usuários em Authentication > Users ============
-- (troque pelos e-mails de vocês e rode)
-- insert into public.casa_membros (user_id) select id from auth.users where email in ('seu@email.com', 'victoria@email.com');
-- insert into public.casa_config (pagador) select id from auth.users where email = 'seu@email.com';
