-- Add basic demographic fields captured during registration.

alter table public.profiles
  add column if not exists gender text
    check (gender is null or gender in ('male', 'female')),
  add column if not exists birthday date
    check (birthday is null or (birthday >= date '1900-01-01' and birthday <= current_date)),
  add column if not exists age int
    check (age is null or age between 0 and 120);

grant update (display_name, city, avatar_url, gender, birthday, age)
  on public.profiles to authenticated;

create or replace function public.profile_age_from_birthday(p_birthday date)
returns int
language sql stable as $$
  select case
    when p_birthday is null then null
    else extract(year from age(current_date, p_birthday))::int
  end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_gender text;
  v_birthday date;
begin
  v_gender := nullif(new.raw_user_meta_data->>'gender', '');

  if coalesce(new.raw_user_meta_data->>'birthday', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_birthday := (new.raw_user_meta_data->>'birthday')::date;
  end if;

  insert into public.profiles (
    id,
    handle,
    display_name,
    city,
    gender,
    birthday,
    age
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'handle', ''), 'blader_' || substr(replace(new.id::text, '-', ''), 1, 10)),
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), new.raw_user_meta_data->>'handle', 'Blader'),
    new.raw_user_meta_data->>'city',
    case when v_gender in ('male', 'female') then v_gender else null end,
    case
      when v_birthday between date '1900-01-01' and current_date then v_birthday
      else null
    end,
    public.profile_age_from_birthday(
      case
        when v_birthday between date '1900-01-01' and current_date then v_birthday
        else null
      end
    )
  );
  return new;
end $$;
