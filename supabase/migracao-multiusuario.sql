-- ===== Rode UMA vez no SQL Editor do Supabase (cole tudo e execute) =====
-- Transforma o banco em multiusuário: várias casas, convites, cadastro aberto.
-- Seus dados atuais são mantidos: a casa de vocês vira a primeira "casa".

-- 1) Casas (substitui a antiga casa_config)
create table public.casas (
  id uuid primary key default gen_random_uuid(),
  nome text default 'Minha casa',
  criado_por uuid references auth.users(id) on delete set null,
  pagador uuid references auth.users(id) on delete set null,
  pct_pagador numeric default 50,
  renda_casa numeric default 0,
  metas jsonb default '{}'::jsonb,
  criada_em timestamptz default now()
);
insert into public.casas (nome, criado_por, pagador, pct_pagador, renda_casa, metas)
select 'Nossa casa', pagador, pagador, pct_pagador, renda_casa, metas from public.casa_config;

-- 2) Membros
alter table public.casa_membros
  add column casa_id uuid references public.casas(id) on delete cascade,
  add column papel text not null default 'membro';
update public.casa_membros set casa_id = (select id from public.casas limit 1);
update public.casa_membros set papel = 'dono' where user_id = (select pagador from public.casas limit 1);
alter table public.casa_membros alter column casa_id set not null;

-- 3) Contas, regras e acertos passam a pertencer a uma casa
alter table public.contas add column casa_id uuid references public.casas(id) on delete cascade;
update public.contas set casa_id = (select id from public.casas limit 1) where escopo = 'casa';
alter table public.contas add constraint contas_casa_coerente check ((escopo = 'casa') = (casa_id is not null));
drop index if exists public.contas_barras_casa;
create unique index contas_barras_casa on public.contas(casa_id, codigo_barras) where escopo = 'casa' and codigo_barras is not null;

alter table public.regras add column casa_id uuid references public.casas(id) on delete cascade;
update public.regras set casa_id = (select id from public.casas limit 1) where escopo = 'casa';

alter table public.acertos add column casa_id uuid references public.casas(id) on delete cascade;
update public.acertos set casa_id = (select id from public.casas limit 1);
alter table public.acertos alter column casa_id set not null;
alter table public.acertos drop constraint acertos_pkey;
alter table public.acertos add primary key (casa_id, mes);

-- 4) Convites
create table public.convites (
  codigo text primary key,
  casa_id uuid not null references public.casas(id) on delete cascade,
  criado_por uuid default auth.uid(),
  expira_em timestamptz not null default now() + interval '7 days',
  usado boolean not null default false
);

-- 5) Remove as regras antigas (valiam para uma casa só)
drop policy if exists perfis_ver on public.perfis;
drop policy if exists membros_ver on public.casa_membros;
drop policy if exists contas_ver on public.contas;
drop policy if exists contas_criar on public.contas;
drop policy if exists contas_editar on public.contas;
drop policy if exists contas_apagar on public.contas;
drop policy if exists regras_ver on public.regras;
drop policy if exists regras_criar on public.regras;
drop policy if exists regras_editar on public.regras;
drop policy if exists acertos_tudo on public.acertos;
drop table public.casa_config;
drop function public.eh_membro();

-- 6) Segurança nova: cada pessoa só enxerga o que é dela e da sua própria casa
create or replace function public.minha_casa() returns uuid
language sql security definer set search_path = public stable
as $$ select casa_id from public.casa_membros where user_id = auth.uid() $$;

alter table public.casas enable row level security;
alter table public.convites enable row level security;

create policy casas_ver on public.casas for select using (id = public.minha_casa());
create policy casas_editar on public.casas for update using (id = public.minha_casa()) with check (id = public.minha_casa());
create policy membros_ver on public.casa_membros for select using (casa_id = public.minha_casa());
create policy convites_ver on public.convites for select using (casa_id = public.minha_casa());
create policy convites_apagar on public.convites for delete using (casa_id = public.minha_casa());
create policy perfis_ver on public.perfis for select using (id = auth.uid() or id in (select user_id from public.casa_membros where casa_id = public.minha_casa()));

create policy contas_ver on public.contas for select using ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and casa_id = public.minha_casa()));
create policy contas_criar on public.contas for insert with check (dono_id = auth.uid() and ((escopo = 'pessoal') or (escopo = 'casa' and casa_id = public.minha_casa())));
create policy contas_editar on public.contas for update using ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and casa_id = public.minha_casa()))
  with check ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and casa_id = public.minha_casa()));
create policy contas_apagar on public.contas for delete using ((escopo = 'pessoal' and dono_id = auth.uid()) or (escopo = 'casa' and casa_id = public.minha_casa()));

create policy regras_ver on public.regras for select using (dono_id = auth.uid() or (escopo = 'casa' and casa_id = public.minha_casa()));
create policy regras_criar on public.regras for insert with check (dono_id = auth.uid() and (casa_id is null or casa_id = public.minha_casa()));
create policy regras_editar on public.regras for update using (dono_id = auth.uid()) with check (dono_id = auth.uid() and (casa_id is null or casa_id = public.minha_casa()));
create policy acertos_tudo on public.acertos for all using (casa_id = public.minha_casa()) with check (casa_id = public.minha_casa());

-- 7) Ações da tela de casa (só estas funções criam casa, convidam e removem pessoas)
create or replace function public.criar_casa(p_nome text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if exists (select 1 from casa_membros where user_id = auth.uid()) then raise exception 'Você já faz parte de uma casa.'; end if;
  insert into casas (nome, criado_por, pagador) values (coalesce(nullif(trim(p_nome), ''), 'Minha casa'), auth.uid(), auth.uid()) returning id into v;
  insert into casa_membros (user_id, casa_id, papel) values (auth.uid(), v, 'dono');
  return v;
end $$;

create or replace function public.gerar_convite() returns text
language plpgsql security definer set search_path = public as $$
declare v_casa uuid := public.minha_casa(); v_codigo text;
begin
  if v_casa is null then raise exception 'Você não tem uma casa.'; end if;
  if not exists (select 1 from casa_membros where user_id = auth.uid() and papel = 'dono') then raise exception 'Só o dono da casa pode convidar.'; end if;
  v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into convites (codigo, casa_id) values (v_codigo, v_casa);
  return v_codigo;
end $$;

create or replace function public.entrar_na_casa(p_codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v convites%rowtype;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if exists (select 1 from casa_membros where user_id = auth.uid()) then raise exception 'Você já faz parte de uma casa. Saia dela antes de entrar em outra.'; end if;
  select * into v from convites where codigo = upper(trim(p_codigo)) and not usado and expira_em > now() for update;
  if not found then raise exception 'Código inválido ou expirado.'; end if;
  insert into casa_membros (user_id, casa_id, papel) values (auth.uid(), v.casa_id, 'membro');
  update convites set usado = true where codigo = v.codigo;
  return v.casa_id;
end $$;

create or replace function public.remover_membro(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_casa uuid := public.minha_casa(); v_papel text;
begin
  select papel into v_papel from casa_membros where user_id = auth.uid();
  if v_casa is null then raise exception 'Você não tem uma casa.'; end if;
  if v_papel is distinct from 'dono' and p_user <> auth.uid() then raise exception 'Só o dono da casa pode remover outras pessoas.'; end if;
  if not exists (select 1 from casa_membros where user_id = p_user and casa_id = v_casa) then raise exception 'Pessoa não encontrada nesta casa.'; end if;
  delete from casa_membros where user_id = p_user;
  if not exists (select 1 from casa_membros where casa_id = v_casa) then
    delete from casas where id = v_casa; -- última pessoa saiu: a casa e as contas dela são apagadas
  else
    if not exists (select 1 from casa_membros where casa_id = v_casa and papel = 'dono') then
      update casa_membros set papel = 'dono' where user_id = (select user_id from casa_membros where casa_id = v_casa limit 1);
    end if;
    update casas set pagador = (select user_id from casa_membros where casa_id = v_casa and papel = 'dono' limit 1)
    where id = v_casa and pagador is not distinct from p_user;
  end if;
end $$;

revoke execute on function public.criar_casa(text), public.gerar_convite(), public.entrar_na_casa(text), public.remover_membro(uuid) from public, anon;
grant execute on function public.criar_casa(text), public.gerar_convite(), public.entrar_na_casa(text), public.remover_membro(uuid) to authenticated;

-- 8) Cadastro: guarda o nome informado na tela de criar conta
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1)));
  return new;
end $$;
