create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('admin')),
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create policy "profiles_read_own_admin"
on public.profiles
for select
using (auth.uid() = id and public.is_admin());

create policy "profiles_no_public_insert"
on public.profiles
for insert
with check (false);

create policy "profiles_no_public_update"
on public.profiles
for update
using (false)
with check (false);

create policy "profiles_no_public_delete"
on public.profiles
for delete
using (false);

create table if not exists public.classes (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(btrim(title)) between 1 and 120),
    starts_at timestamptz not null,
    ends_at timestamptz null check (ends_at is null or ends_at > starts_at),
    capacity integer not null default 25 check (capacity > 0),
    status text not null default 'published' check (status in ('draft', 'published', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists classes_starts_at_status_idx
    on public.classes (starts_at, status);

alter table public.classes enable row level security;

create policy "classes_admin_manage"
on public.classes
for all
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.reservations (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    student_name text not null check (length(btrim(student_name)) between 1 and 80),
    phone text not null check (phone ~ '^[0-9]{8,15}$'),
    email text null check (email is null or length(email) <= 120),
    status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
    created_at timestamptz not null default now()
);

create unique index if not exists reservations_active_phone_per_class_idx
    on public.reservations (class_id, phone)
    where status = 'confirmed';

create index if not exists reservations_class_id_status_idx
    on public.reservations (class_id, status);

create or replace function public.prevent_capacity_below_confirmed_reservations()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
    v_confirmed_count integer;
begin
    if new.capacity < old.capacity then
        select count(*)::int
        into v_confirmed_count
        from public.reservations r
        where r.class_id = new.id
          and r.status = 'confirmed';

        if new.capacity < v_confirmed_count then
            raise exception 'CAPACITY_BELOW_CONFIRMED_RESERVATIONS';
        end if;
    end if;

    return new;
end;
$$;

revoke all on function public.prevent_capacity_below_confirmed_reservations() from public, anon, authenticated;

create trigger classes_capacity_not_below_confirmed_reservations
before update of capacity on public.classes
for each row
execute function public.prevent_capacity_below_confirmed_reservations();

alter table public.reservations enable row level security;

create policy "reservations_public_no_access"
on public.reservations
for select
using (false);

create policy "reservations_public_no_write"
on public.reservations
for insert
with check (false);

create policy "reservations_public_no_update"
on public.reservations
for update
using (false)
with check (false);

create policy "reservations_public_no_delete"
on public.reservations
for delete
using (false);

create policy "reservations_admin_manage"
on public.reservations
for all
using (public.is_admin())
with check (public.is_admin());

create view public.published_classes_public as
select
    c.id,
    c.title,
    c.starts_at,
    c.ends_at,
    c.capacity,
    c.status,
    greatest(
        c.capacity - coalesce(
            (
                select count(*)
                from public.reservations r
                where r.class_id = c.id
                  and r.status = 'confirmed'
            ),
            0
        ),
        0
    )::int as available_slots
from public.classes c
where c.status = 'published'
  and c.starts_at > now();

revoke all on public.classes from public, anon, authenticated;
revoke all on public.reservations from public, anon, authenticated;
revoke all on public.profiles from public, anon, authenticated;
revoke all on public.published_classes_public from public, anon, authenticated;

grant select on public.published_classes_public to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.classes to authenticated;
grant insert, update, delete on public.classes to authenticated;
grant select on public.reservations to authenticated;
grant insert, update, delete on public.reservations to authenticated;
grant select on public.profiles to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create trigger classes_set_updated_at
before update on public.classes
for each row
execute function public.set_updated_at();

create or replace function public.book_class(
    p_class_id uuid,
    p_student_name text,
    p_phone text,
    p_email text default null
)
returns json
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_class public.classes%rowtype;
    v_phone text;
    v_verified_phone text;
    v_phone_confirmed_at timestamptz;
    v_email text;
    v_count integer;
    v_reservation_id uuid;
begin
    if p_class_id is null then
        raise exception 'INVALID_CLASS_ID';
    end if;

    if p_student_name is null or btrim(p_student_name) = '' then
        raise exception 'INVALID_STUDENT_NAME';
    end if;
    if length(btrim(p_student_name)) > 80 then
        raise exception 'INVALID_STUDENT_NAME';
    end if;

    if p_phone is null or btrim(p_phone) = '' then
        raise exception 'INVALID_PHONE';
    end if;

    v_phone := regexp_replace(btrim(p_phone), '[^0-9]', '', 'g');
    if length(v_phone) < 8 or length(v_phone) > 15 then
        raise exception 'INVALID_PHONE';
    end if;

    if auth.uid() is null then
        raise exception 'PHONE_VERIFICATION_REQUIRED';
    end if;

    select u.phone, u.phone_confirmed_at
    into v_verified_phone, v_phone_confirmed_at
    from auth.users u
    where u.id = auth.uid();

    if v_phone_confirmed_at is null or v_verified_phone is null then
        raise exception 'PHONE_VERIFICATION_REQUIRED';
    end if;
    if regexp_replace(v_verified_phone, '[^0-9]', '', 'g') <> v_phone then
        raise exception 'VERIFIED_PHONE_MISMATCH';
    end if;

    if p_email is not null then
        v_email := lower(btrim(p_email));
        if length(v_email) > 120 then
            raise exception 'INVALID_EMAIL';
        end if;
        if v_email <> '' and v_email !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*$' then
            raise exception 'INVALID_EMAIL';
        end if;
    else
        v_email := null;
    end if;

    select *
    into v_class
    from public.classes
    where id = p_class_id
    for update;

    if not found then
        raise exception 'CLASS_NOT_FOUND';
    end if;

    if v_class.status <> 'published' then
        raise exception 'CLASS_UNAVAILABLE';
    end if;

    if v_class.starts_at <= now() then
        raise exception 'CLASS_STARTED';
    end if;

    if exists (
        select 1
        from public.reservations r
        where r.class_id = p_class_id
          and r.phone = v_phone
          and r.status = 'confirmed'
    ) then
        raise exception 'ALREADY_RESERVED';
    end if;

    select count(*)
    into v_count
    from public.reservations r
    where r.class_id = p_class_id
      and r.status = 'confirmed';

    if v_count >= v_class.capacity then
        raise exception 'CLASS_FULL';
    end if;

    insert into public.reservations (class_id, student_name, phone, email, status)
    values (
        p_class_id,
        btrim(p_student_name),
        v_phone,
        v_email,
        'confirmed'
    )
    returning id into v_reservation_id;

    return json_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'message', 'Reserva confirmada'
    );
end;
$$;

revoke all on function public.book_class(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.book_class(uuid, text, text, text) to authenticated;

-- Ejemplo de creación manual de perfil administrador:
-- insert into public.profiles (id, role)
-- values ('<uuid-auth-user>', 'admin');
