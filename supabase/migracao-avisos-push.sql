-- ===== Rode UMA vez no SQL Editor do Supabase =====
-- Guarda os aparelhos (celular, computador) que ativaram os avisos de vencimento.
create table public.push_inscricoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  aparelho text,
  criado_em timestamptz not null default now()
);
alter table public.push_inscricoes enable row level security;
create policy push_ver on public.push_inscricoes for select using (user_id = auth.uid());
create policy push_apagar on public.push_inscricoes for delete using (user_id = auth.uid());

-- Cadastro do aparelho (se o mesmo aparelho já era de outra conta, passa para quem está logado)
create or replace function public.registrar_push(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  insert into push_inscricoes (user_id, endpoint, p256dh, auth, aparelho)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_aparelho)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, aparelho = excluded.aparelho;
end $$;
revoke execute on function public.registrar_push(text, text, text, text) from public, anon;
grant execute on function public.registrar_push(text, text, text, text) to authenticated;
