-- Run only against a disposable Supabase project after applying the migration.
-- Transactional checks run as the SQL editor owner, so they do not prove RLS.
-- Use the anon/authenticated REST API separately for role-policy checks.
-- Requires two Auth users with distinct, SMS-confirmed phone numbers.

begin;

do $$
declare
    test_class_id uuid;
    test_user_one uuid;
    test_user_two uuid;
    test_phone_one text;
    test_phone_two text;
    first_result json;
    second_result json;
    confirmed_count integer;
begin
    select u.id, regexp_replace(u.phone, '[^0-9]', '', 'g')
    into test_user_one, test_phone_one
    from auth.users u
    where u.phone_confirmed_at is not null and u.phone is not null
    order by u.created_at
    limit 1;

    select u.id, regexp_replace(u.phone, '[^0-9]', '', 'g')
    into test_user_two, test_phone_two
    from auth.users u
    where u.phone_confirmed_at is not null
      and u.phone is not null
      and regexp_replace(u.phone, '[^0-9]', '', 'g') <> test_phone_one
    order by u.created_at
    limit 1;

    if test_user_one is null or test_user_two is null then
        raise exception 'Create two Auth users with distinct SMS-confirmed phones before running SQL verification';
    end if;

    perform set_config('request.jwt.claim.sub', test_user_one::text, true);
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', test_user_one::text, 'role', 'authenticated')::text,
        true
    );

    insert into public.classes (title, starts_at, capacity, status)
    values ('TEST ONLY - concurrency fixture', now() + interval '2 days', 1, 'published')
    returning id into test_class_id;

    first_result := public.book_class(
        test_class_id,
        'Test alumno uno',
        test_phone_one,
        null
    );
    if first_result ->> 'success' <> 'true' then
        raise exception 'Initial reservation was not confirmed';
    end if;

    begin
        perform public.book_class(
            test_class_id,
            'Test alumno duplicado',
            test_phone_one,
            null
        );
        raise exception 'Expected ALREADY_RESERVED for duplicate phone';
    exception
        when raise_exception then
            if sqlerrm <> 'ALREADY_RESERVED' then
                raise;
            end if;
    end;

    begin
        perform public.book_class(
            test_class_id,
            'Test alumno sin cupo',
            test_phone_two,
            null
        );
        raise exception 'Expected CLASS_FULL for the next booking';
    exception
        when raise_exception then
            if sqlerrm <> 'CLASS_FULL' then
                raise;
            end if;
    end;

    update public.reservations
    set status = 'cancelled'
    where class_id = test_class_id
      and status = 'confirmed';

    perform set_config('request.jwt.claim.sub', test_user_two::text, true);
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', test_user_two::text, 'role', 'authenticated')::text,
        true
    );
    second_result := public.book_class(
        test_class_id,
        'Test alumno dos',
        test_phone_two,
        null
    );
    if second_result ->> 'success' <> 'true' then
        raise exception 'Cancelled reservation did not release its slot';
    end if;

    update public.classes
    set status = 'cancelled'
    where id = test_class_id;

    begin
        perform public.book_class(
            test_class_id,
            'Test alumno tres',
            test_phone_one,
            null
        );
        raise exception 'Expected CLASS_UNAVAILABLE for cancelled class';
    exception
        when raise_exception then
            if sqlerrm <> 'CLASS_UNAVAILABLE' then
                raise;
            end if;
    end;

    select count(*) into confirmed_count
    from public.reservations
    where class_id = test_class_id
      and status = 'confirmed';
    if confirmed_count <> 1 then
        raise exception 'Expected exactly one confirmed reservation, got %', confirmed_count;
    end if;

    insert into public.classes (title, starts_at, capacity, status)
    values ('TEST ONLY - capacity fixture', now() + interval '3 days', 2, 'published')
    returning id into test_class_id;

    perform set_config('request.jwt.claim.sub', test_user_one::text, true);
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', test_user_one::text, 'role', 'authenticated')::text,
        true
    );
    perform public.book_class(
        test_class_id,
        'Test alumno capacidad uno',
        test_phone_one,
        null
    );

    perform set_config('request.jwt.claim.sub', test_user_two::text, true);
    perform set_config(
        'request.jwt.claims',
        json_build_object('sub', test_user_two::text, 'role', 'authenticated')::text,
        true
    );
    perform public.book_class(
        test_class_id,
        'Test alumno capacidad dos',
        test_phone_two,
        null
    );

    begin
        update public.classes set capacity = 1 where id = test_class_id;
        raise exception 'Expected capacity reduction below confirmed bookings to fail';
    exception
        when raise_exception then
            if sqlerrm <> 'CAPACITY_BELOW_CONFIRMED_RESERVATIONS' then
                raise;
            end if;
    end;
end;
$$;

rollback;

-- RLS/API checks (run with anon/authenticated JWTs through Supabase REST API):
-- anon: GET /rest/v1/published_classes_public?select=id,title,starts_at,ends_at,capacity,status,available_slots -> allowed.
-- anon: GET /rest/v1/reservations?select=* -> denied by table privileges.
-- anon: POST /rest/v1/classes -> denied by table privileges.
-- anon: POST /rest/v1/rpc/book_class -> denied by function privileges.
-- authenticated non-admin: GET /rest/v1/classes and /reservations -> zero visible rows.
-- authenticated non-admin: INSERT/UPDATE/DELETE classes/reservations -> denied by RLS.
-- authenticated admin: dashboard queries succeed, but profile writes are not granted.
-- SECURITY: inspect Postgres function ACL and search_path after deployment; only book_class
-- is executable by authenticated users, and only users with a confirmed phone
-- matching p_phone may reserve.

-- For concurrency, use tests/supabase-concurrency.test.js with an isolated published
-- one-capacity class that currently has exactly one available slot. It makes two
-- concurrent RPC requests using distinct, verified Auth phone accounts and expects one win.
