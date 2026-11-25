BEGIN;

CREATE FUNCTION public.vendelier_find_member_tenant(account_id UUID)
RETURNS TABLE (id UUID, slug TEXT, name TEXT, published_at TIMESTAMPTZ, role public.membership_role)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT tenant.id, tenant.slug, tenant.name, tenant.published_at, membership.role
    FROM public.tenants AS tenant
    JOIN public.memberships AS membership ON membership.tenant_id = tenant.id
    WHERE membership.user_id = account_id AND tenant.status = 'active'
    ORDER BY (membership.role = 'owner') DESC, membership.created_at, tenant.id
    LIMIT 1;
$$;

CREATE FUNCTION public.vendelier_list_tenant_members(target_tenant_id UUID)
RETURNS TABLE (user_id UUID, email TEXT, role public.membership_role, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT u.id AS user_id, u.email, m.role, m.created_at
    FROM public.memberships AS m
    JOIN public.users AS u ON u.id = m.user_id
    WHERE m.tenant_id = target_tenant_id
    ORDER BY (m.role = 'owner') DESC, m.created_at ASC;
$$;

CREATE FUNCTION public.vendelier_invite_tenant_member(
    target_tenant_id UUID,
    member_email TEXT,
    default_hash TEXT,
    member_role public.membership_role
)
RETURNS TABLE (user_id UUID, email TEXT, role public.membership_role, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    target_user_id UUID;
    membership_created TIMESTAMPTZ;
BEGIN
    SELECT u.id INTO target_user_id
    FROM public.users AS u
    WHERE u.email = member_email;

    IF target_user_id IS NULL THEN
        target_user_id := gen_random_uuid();
        INSERT INTO public.users (id, email, password_hash)
        VALUES (target_user_id, member_email, default_hash);
    END IF;

    INSERT INTO public.memberships (tenant_id, user_id, role)
    VALUES (target_tenant_id, target_user_id, member_role)
    RETURNING memberships.created_at INTO membership_created;

    RETURN QUERY SELECT target_user_id, member_email, member_role, membership_created;
END;
$$;

CREATE FUNCTION public.vendelier_update_member_role(
    target_tenant_id UUID,
    target_user_id UUID,
    next_role public.membership_role
)
RETURNS TABLE (user_id UUID, email TEXT, role public.membership_role, created_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
    current_role public.membership_role;
BEGIN
    SELECT m.role INTO current_role
    FROM public.memberships AS m
    WHERE m.tenant_id = target_tenant_id AND m.user_id = target_user_id;

    IF NOT FOUND OR current_role = 'owner' OR next_role = 'owner' THEN
        RETURN;
    END IF;

    UPDATE public.memberships AS m
    SET role = next_role
    WHERE m.tenant_id = target_tenant_id AND m.user_id = target_user_id;

    RETURN QUERY
    SELECT u.id, u.email, m.role, m.created_at
    FROM public.memberships AS m
    JOIN public.users AS u ON u.id = m.user_id
    WHERE m.tenant_id = target_tenant_id AND m.user_id = target_user_id;
END;
$$;

CREATE FUNCTION public.vendelier_remove_tenant_member(
    target_tenant_id UUID,
    target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    DELETE FROM public.memberships AS m
    WHERE m.tenant_id = target_tenant_id AND m.user_id = target_user_id AND m.role <> 'owner';
    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.vendelier_find_member_tenant(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendelier_list_tenant_members(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendelier_invite_tenant_member(UUID, TEXT, TEXT, public.membership_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendelier_update_member_role(UUID, UUID, public.membership_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vendelier_remove_tenant_member(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.vendelier_find_member_tenant(UUID) TO vendelier_app;
GRANT EXECUTE ON FUNCTION public.vendelier_list_tenant_members(UUID) TO vendelier_app;
GRANT EXECUTE ON FUNCTION public.vendelier_invite_tenant_member(UUID, TEXT, TEXT, public.membership_role) TO vendelier_app;
GRANT EXECUTE ON FUNCTION public.vendelier_update_member_role(UUID, UUID, public.membership_role) TO vendelier_app;
GRANT EXECUTE ON FUNCTION public.vendelier_remove_tenant_member(UUID, UUID) TO vendelier_app;

COMMIT;
