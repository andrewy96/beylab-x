-- Move demographics (gender, birthday, age) off the public profiles table into
-- an owner-only table, so public profile reads can no longer expose them.

create table if not exists public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  gender text
    check (gender is null or gender in ('male', 'female')),
  birthday date
    check (birthday is null or (birthday >= date '1900-01-01' and birthday <= current_date)),
  age int
    check (age is null or age between 0 and 120)
);

alter table public.profile_private enable row level security;

create policy "read own private profile" on public.profile_private
  for select using (auth.uid() = id);

create policy "insert own private profile" on public.profile_private
  for insert with check (auth.uid() = id);

create policy "update own private profile" on public.profile_private
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.profile_private from anon;
grant select, insert, update on public.profile_private to authenticated;

-- Copy existing demographics before dropping the public columns.
insert into public.profile_private (id, gender, birthday, age)
select id, gender, birthday, age from public.profiles
on conflict (id) do update
  set gender = excluded.gender,
      birthday = excluded.birthday,
      age = excluded.age;

alter table public.profiles
  drop column if exists gender,
  drop column if exists birthday,
  drop column if exists age;

-- Signup trigger: public fields to profiles, demographics to profile_private.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_gender text;
  v_birthday date;
begin
  v_gender := nullif(new.raw_user_meta_data->>'gender', '');
  if v_gender is not null and v_gender not in ('male', 'female') then
    v_gender := null;
  end if;

  if coalesce(new.raw_user_meta_data->>'birthday', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_birthday := (new.raw_user_meta_data->>'birthday')::date;
  end if;
  if v_birthday is not null
     and not (v_birthday between date '1900-01-01' and current_date) then
    v_birthday := null;
  end if;

  insert into public.profiles (id, handle, display_name, city)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'handle', ''), 'blader_' || substr(replace(new.id::text, '-', ''), 1, 10)),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), new.raw_user_meta_data->>'handle', 'Blader'),
    new.raw_user_meta_data->>'city'
  );

  insert into public.profile_private (id, gender, birthday, age)
  values (new.id, v_gender, v_birthday, public.profile_age_from_birthday(v_birthday));

  return new;
end $$;
