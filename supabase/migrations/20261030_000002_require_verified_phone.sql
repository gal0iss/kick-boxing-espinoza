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
