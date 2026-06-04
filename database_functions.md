# Supabase Database Functions

## Function: `create_default_company_user`
```sql
CREATE OR REPLACE FUNCTION public.create_default_company_user()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO public.users (
        orgcode,
        userid,
        password,
        isadmin,
        isactive
    )
    VALUES (
        NEW.orgcode,
        'admin',
        'admin@123',
        true,
        true
    );

    RETURN NEW;
END;
$function$

```

## Function: `add_company`
```sql
CREATE OR REPLACE FUNCTION public.add_company(p_orgcode character varying, p_orgname character varying)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
BEGIN
    INSERT INTO public.company (
        orgcode,
        orgname
    )
    VALUES (
        p_orgcode,
        p_orgname
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Company created successfully',
        'orgcode', p_orgcode
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Company already exists'
        );

    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `get_users`
```sql
CREATE OR REPLACE FUNCTION public.get_users(p_authtoken uuid, p_orgcode character varying)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_logged_user public.users%ROWTYPE;
    v_result json;
BEGIN
    SELECT *
    INTO v_logged_user
    FROM public.users
    WHERE authtoken = p_authtoken
      AND orgcode = p_orgcode;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Invalid auth token');
    END IF;

    IF COALESCE(v_logged_user.isactive, false) = false THEN
        RETURN json_build_object('success', false, 'message', 'User is disabled');
    END IF;

    IF COALESCE(v_logged_user.isadmin, false) = false THEN
        RETURN json_build_object('success', false, 'message', 'Only admin user can view users');
    END IF;

    SELECT json_agg(
        json_build_object(
            'userid', userid,
            'isadmin', isadmin,
            'isactive', isactive,
            'otp', otp,
            'created_at', created_at
        ) ORDER BY userid
    )
    INTO v_result
    FROM public.users
    WHERE orgcode = p_orgcode;

    RETURN json_build_object(
        'success', true,
        'users', COALESCE(v_result, '[]'::json)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$function$

```

## Function: `save_slip`
```sql
CREATE OR REPLACE FUNCTION public.save_slip(p_orgcode character varying, p_phone character varying, p_name character varying, p_address character varying, p_totalamount numeric, p_discount numeric, p_items json)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_slip_id bigint;
    v_slipno bigint;
    v_item json;
BEGIN

    ---------------------------------------------------
    -- Generate next slip number
    ---------------------------------------------------
    SELECT COALESCE(MAX(slipno), 0) + 1
    INTO v_slipno
    FROM public.slips
    WHERE orgcode = p_orgcode;

    ---------------------------------------------------
    -- Insert slip
    ---------------------------------------------------
    INSERT INTO public.slips (
        orgcode,
        slipno,
        phone,
        name,
        address,
        totalamount,
        discount
    )
    VALUES (
        p_orgcode,
        v_slipno,
        p_phone,
        p_name,
        p_address,
        p_totalamount,
        p_discount
    )
    RETURNING id
    INTO v_slip_id;

    ---------------------------------------------------
    -- Insert slip items
    ---------------------------------------------------
    FOR v_item IN
        SELECT * FROM json_array_elements(p_items)
    LOOP

        INSERT INTO public.slipitems (
            id,
            item,
            remarks,
            qty,
            rate
        )
        VALUES (
            v_slip_id,
            v_item ->> 'item',
            v_item ->> 'remarks',
            COALESCE((v_item ->> 'qty')::numeric, 0),
            COALESCE((v_item ->> 'rate')::numeric, 0)
        );

    END LOOP;

    ---------------------------------------------------
    -- Success response
    ---------------------------------------------------
    RETURN json_build_object(
        'success', true,
        'message', 'Slip No ' || v_slipno || ' created successfully',
        'slip_id', v_slip_id,
        'slipno', v_slipno
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `close_account`
```sql
CREATE OR REPLACE FUNCTION public.close_account(p_orgcode character varying, p_phone character varying)
 RETURNS json
 LANGUAGE plpgsql
AS $function$DECLARE
    v_slip_count integer;
    v_payment_count integer;
BEGIN

    ---------------------------------------------------
    -- Count slips
    ---------------------------------------------------
    SELECT COUNT(*)
    INTO v_slip_count
    FROM public.slips
    WHERE orgcode = p_orgcode
      AND phone = p_phone;

    ---------------------------------------------------
    -- Count payments
    ---------------------------------------------------
    SELECT COUNT(*)
    INTO v_payment_count
    FROM public.payments
    WHERE orgcode = p_orgcode
      AND phone = p_phone::numeric;

    ---------------------------------------------------
    -- Delete slips
    -- Slipitems auto delete via CASCADE
    ---------------------------------------------------
    DELETE FROM public.slips
    WHERE orgcode = p_orgcode
      AND phone = p_phone;

    ---------------------------------------------------
    -- Delete payments
    ---------------------------------------------------
    DELETE FROM public.payments
    WHERE orgcode = p_orgcode
      AND phone = p_phone::numeric;

    ---------------------------------------------------
    -- Success response
    ---------------------------------------------------
    RETURN json_build_object(
        'success', true,
        'message', 'Account closed successfully',
        'deleted_slips', v_slip_count,
        'deleted_payments', v_payment_count,
        'phone', p_phone
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;$function$

```

## Function: `closeaccount`
```sql
CREATE OR REPLACE FUNCTION public.closeaccount(p_authtoken uuid, p_orgcode character varying, p_phone character varying)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_logged_user public.users%ROWTYPE;
    v_slip_count integer;
    v_payment_count integer;
BEGIN

    ---------------------------------------------------
    -- Only admin can close account
    ---------------------------------------------------
    SELECT *
    INTO v_logged_user
    FROM public.users
    WHERE authtoken = p_authtoken
      AND orgcode = p_orgcode
      AND isadmin = true;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Only admin user can close account'
        );
    END IF;

    ---------------------------------------------------
    -- Count slips
    ---------------------------------------------------
    SELECT COUNT(*)
    INTO v_slip_count
    FROM public.slips
    WHERE orgcode = p_orgcode
      AND phone = p_phone;

    ---------------------------------------------------
    -- Count payments
    ---------------------------------------------------
    SELECT COUNT(*)
    INTO v_payment_count
    FROM public.payments
    WHERE orgcode = p_orgcode
      AND phone = p_phone::numeric;

    ---------------------------------------------------
    -- Delete slips
    -- Slipitems auto delete via CASCADE
    ---------------------------------------------------
    DELETE FROM public.slips
    WHERE orgcode = p_orgcode
      AND phone = p_phone;

    ---------------------------------------------------
    -- Delete payments
    ---------------------------------------------------
    DELETE FROM public.payments
    WHERE orgcode = p_orgcode
      AND phone = p_phone::numeric;

    ---------------------------------------------------
    -- Success response
    ---------------------------------------------------
    RETURN json_build_object(
        'success', true,
        'message', 'Account closed successfully',
        'deleted_slips', v_slip_count,
        'deleted_payments', v_payment_count,
        'phone', p_phone
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `manage_slipitem`
```sql
CREATE OR REPLACE FUNCTION public.manage_slipitem(p_orgcode character varying, p_slipno bigint, p_action character varying, p_old_item character varying, p_item character varying, p_remarks character varying, p_qty numeric, p_rate numeric)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_slip_id bigint;
BEGIN

    ---------------------------------------------------
    -- Get Slip ID
    ---------------------------------------------------
    SELECT id
    INTO v_slip_id
    FROM public.slips
    WHERE orgcode = p_orgcode
      AND slipno = p_slipno;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Slip not found'
        );
    END IF;

    ---------------------------------------------------
    -- ADD ITEM
    ---------------------------------------------------
    IF UPPER(p_action) = 'ADD' THEN

        INSERT INTO public.slipitems (
            id,
            item,
            remarks,
            qty,
            rate
        )
        VALUES (
            v_slip_id,
            p_item,
            p_remarks,
            p_qty,
            p_rate
        );

        RETURN json_build_object(
            'success', true,
            'message', 'Item added successfully'
        );

    END IF;

    ---------------------------------------------------
    -- UPDATE ITEM
    ---------------------------------------------------
    IF UPPER(p_action) = 'UPDATE' THEN

        UPDATE public.slipitems
        SET
            item = p_item,
            remarks = p_remarks,
            qty = p_qty,
            rate = p_rate
        WHERE id = v_slip_id
          AND item = p_old_item;

        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Item not found'
            );
        END IF;

        RETURN json_build_object(
            'success', true,
            'message', 'Item updated successfully'
        );

    END IF;

    ---------------------------------------------------
    -- DELETE ITEM
    ---------------------------------------------------
    IF UPPER(p_action) = 'DELETE' THEN

        DELETE FROM public.slipitems
        WHERE id = v_slip_id
          AND item = p_old_item;

        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Item not found'
            );
        END IF;

        RETURN json_build_object(
            'success', true,
            'message', 'Item deleted successfully'
        );

    END IF;

    RETURN json_build_object(
        'success', false,
        'message', 'Invalid action. Use ADD, UPDATE or DELETE'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `save_payment`
```sql
CREATE OR REPLACE FUNCTION public.save_payment(p_orgcode character varying, p_id bigint, p_phone numeric, p_amount numeric, p_narration character varying)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_payment_id bigint;
BEGIN

    ---------------------------------------------------
    -- Update Existing Payment
    ---------------------------------------------------
    IF COALESCE(p_id, 0) > 0 THEN

        UPDATE public.payments
        SET
            phone = p_phone,
            amount = p_amount,
            narration = p_narration
        WHERE id = p_id
          AND orgcode = p_orgcode;

        IF NOT FOUND THEN
            RETURN json_build_object(
                'success', false,
                'message', 'Payment not found'
            );
        END IF;

        RETURN json_build_object(
            'success', true,
            'message', 'Payment updated successfully',
            'payment_id', p_id
        );

    END IF;

    ---------------------------------------------------
    -- Insert New Payment
    ---------------------------------------------------
    INSERT INTO public.payments (
        orgcode,
        phone,
        amount,
        narration
    )
    VALUES (
        p_orgcode,
        p_phone,
        p_amount,
        p_narration
    )
    RETURNING id
    INTO v_payment_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Payment added successfully',
        'payment_id', v_payment_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `get_account_summary`
```sql
CREATE OR REPLACE FUNCTION public.get_account_summary(p_orgcode character varying, p_phone character varying)
 RETURNS TABLE(txn_date date, totalamount numeric, discount numeric, netamount numeric, paymentmade numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN

    RETURN QUERY

    WITH slip_summary AS (
        SELECT
            s.date::date AS txn_date,
            SUM(COALESCE(s.totalamount,0)) AS totalamount,
            SUM(COALESCE(s.discount,0)) AS discount,
            SUM(COALESCE(s.netamount,0)) AS netamount
        FROM public.slips s
        WHERE s.orgcode = p_orgcode
          AND s.phone = p_phone
        GROUP BY s.date::date
    ),

    payment_summary AS (
        SELECT
            p.date::date AS txn_date,
            SUM(COALESCE(p.amount,0)) AS paymentmade
        FROM public.payments p
        WHERE p.orgcode = p_orgcode
          AND p.phone = p_phone::numeric
        GROUP BY p.date::date
    )

    SELECT
        COALESCE(s.txn_date, p.txn_date) AS txn_date,
        COALESCE(s.totalamount,0) AS totalamount,
        COALESCE(s.discount,0) AS discount,
        COALESCE(s.netamount,0) AS netamount,
        COALESCE(p.paymentmade,0) AS paymentmade
    FROM slip_summary s
    FULL OUTER JOIN payment_summary p
        ON s.txn_date = p.txn_date
    ORDER BY txn_date;

END;
$function$

```

## Function: `get_account_details_by_date`
```sql
CREATE OR REPLACE FUNCTION public.get_account_details_by_date(p_orgcode character varying, p_phone character varying, p_date date)
 RETURNS TABLE(slipno bigint, slip_date date, item character varying, remarks character varying, qty numeric, rate numeric, itemamount numeric, totalamount numeric, discount numeric, netamount numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN

    RETURN QUERY

    SELECT
        s.slipno,
        s.date::date,
        si.item,
        si.remarks,
        si.qty,
        si.rate,
        si.amount,
        s.totalamount,
        s.discount,
        s.netamount
    FROM public.slips s
    INNER JOIN public.slipitems si
        ON si.id = s.id
    WHERE s.orgcode = p_orgcode
      AND s.phone = p_phone
      AND s.date::date = p_date
    ORDER BY s.slipno, si.item;

END;
$function$

```

## Function: `update_company`
```sql
CREATE OR REPLACE FUNCTION public.update_company(p_authtoken uuid, p_orgname character varying, p_isactive boolean, p_enableotp boolean)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user public.users%ROWTYPE;
BEGIN

    ---------------------------------------------------
    -- Validate admin user
    ---------------------------------------------------
    SELECT *
    INTO v_user
    FROM public.users
    WHERE authtoken = p_authtoken
      AND isadmin = true;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Only admin user can modify company'
        );
    END IF;

    ---------------------------------------------------
    -- Update company of logged-in admin
    ---------------------------------------------------
    UPDATE public.company
    SET
        orgname = p_orgname,
        isactive = p_isactive,
        enableotp = p_enableotp
    WHERE orgcode = v_user.orgcode;

    RETURN json_build_object(
        'success', true,
        'message', 'Company updated successfully',
        'orgcode', v_user.orgcode
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `login_user`
```sql
CREATE OR REPLACE FUNCTION public.login_user(p_orgcode character varying, p_userid character varying, p_password character varying, p_otp integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user public.users%ROWTYPE;
    v_enableotp boolean;
BEGIN

    ---------------------------------------------------
    -- Validate Company
    ---------------------------------------------------
    SELECT enableotp
    INTO v_enableotp
    FROM public.company
    WHERE orgcode = p_orgcode;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Company does not exist'
        );
    END IF;

    ---------------------------------------------------
    -- Validate User
    ---------------------------------------------------
    SELECT *
    INTO v_user
    FROM public.users
    WHERE orgcode = p_orgcode
      AND userid = p_userid;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'User does not exist'
        );
    END IF;

    ---------------------------------------------------
    -- User Active Check
    ---------------------------------------------------
    IF COALESCE(v_user.isactive, false) = false THEN
        RETURN json_build_object(
            'success', false,
            'message', 'User is disabled'
        );
    END IF;

    ---------------------------------------------------
    -- Password Check
    ---------------------------------------------------
    IF COALESCE(v_user.password, '') <> p_password THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid password'
        );
    END IF;

    ---------------------------------------------------
    -- Admin User
    ---------------------------------------------------
    IF COALESCE(v_user.isadmin, false) = true THEN
        RETURN json_build_object(
            'success', true,
            'otprequired', false,
            'message', 'Login successful',
            'authtoken', v_user.authtoken,
            'isadmin', true
        );
    END IF;

    ---------------------------------------------------
    -- Non Admin + OTP Disabled
    ---------------------------------------------------
    IF COALESCE(v_enableotp, false) = false THEN
        RETURN json_build_object(
            'success', true,
            'otprequired', false,
            'message', 'Login successful',
            'authtoken', v_user.authtoken,
            'isadmin', false
        );
    END IF;

    ---------------------------------------------------
    -- OTP Required (First Call)
    ---------------------------------------------------
    IF p_otp IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'otprequired', true,
            'message', 'OTP required'
        );
    END IF;

    ---------------------------------------------------
    -- OTP Validation (Second Call)
    ---------------------------------------------------
    IF COALESCE(v_user.otp, 0) <> p_otp THEN
        RETURN json_build_object(
            'success', false,
            'otprequired', true,
            'message', 'Invalid OTP'
        );
    END IF;

    ---------------------------------------------------
    -- Successful Login
    ---------------------------------------------------
    RETURN json_build_object(
        'success', true,
        'otprequired', false,
        'message', 'Login successful',
        'authtoken', v_user.authtoken,
        'isadmin', false
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `search_accounts`
```sql
CREATE OR REPLACE FUNCTION public.search_accounts(p_orgcode character varying, p_search character varying)
 RETURNS TABLE(phone character varying, name character varying, address character varying)
 LANGUAGE plpgsql
AS $function$
BEGIN

    RETURN QUERY

    SELECT DISTINCT
        s.phone,
        s.name,
        s.address
    FROM public.slips s
    WHERE s.orgcode = p_orgcode
      AND (
            COALESCE(s.phone,'') ILIKE '%' || p_search || '%'
         OR COALESCE(s.name,'') ILIKE '%' || p_search || '%'
         OR COALESCE(s.address,'') ILIKE '%' || p_search || '%'
      )
    ORDER BY s.name;

END;
$function$

```

## Function: `save_user`
```sql
CREATE OR REPLACE FUNCTION public.save_user(p_authtoken uuid, p_orgcode character varying, p_userid character varying, p_password character varying, p_isadmin boolean, p_isactive boolean)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_logged_user public.users%ROWTYPE;
BEGIN

    ---------------------------------------------------
    -- Validate logged-in user using authtoken
    ---------------------------------------------------
    SELECT *
    INTO v_logged_user
    FROM public.users
    WHERE authtoken = p_authtoken
      AND orgcode = p_orgcode;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Invalid auth token'
        );
    END IF;

    ---------------------------------------------------
    -- Check user active
    ---------------------------------------------------
    IF COALESCE(v_logged_user.isactive, false) = false THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Logged in user is disabled'
        );
    END IF;

    ---------------------------------------------------
    -- Only admin can add/modify users
    ---------------------------------------------------
    IF COALESCE(v_logged_user.isadmin, false) = false THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Only admin user can manage users'
        );
    END IF;

    ---------------------------------------------------
    -- Update existing user
    ---------------------------------------------------
    IF EXISTS (
        SELECT 1
        FROM public.users
        WHERE orgcode = p_orgcode
          AND userid = p_userid
    ) THEN

        ---------------------------------------------------
        -- Protection for 'admin' user
        ---------------------------------------------------
        IF p_userid = 'admin' THEN
            RETURN json_build_object(
                'success', false,
                'message', 'The primary admin account cannot be modified.'
            );
        END IF;

        UPDATE public.users
        SET
            password = p_password,
            isadmin = p_isadmin,
            isactive = p_isactive,
            otp = CASE
                      WHEN p_isadmin = false
                      THEN FLOOR(1000 + RANDOM() * 9000)::int
                      ELSE NULL
                  END
        WHERE orgcode = p_orgcode
          AND userid = p_userid;

        RETURN json_build_object(
            'success', true,
            'message', 'User updated successfully'
        );

    END IF;

    ---------------------------------------------------
    -- Insert new user
    ---------------------------------------------------
    INSERT INTO public.users (
        orgcode,
        userid,
        password,
        isadmin,
        isactive,
        otp
    )
    VALUES (
        p_orgcode,
        p_userid,
        p_password,
        p_isadmin,
        p_isactive,
        CASE
            WHEN p_isadmin = false
            THEN FLOOR(1000 + RANDOM() * 9000)::int
            ELSE NULL
        END
    );

    RETURN json_build_object(
        'success', true,
        'message', 'User created successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', SQLERRM
        );
END;
$function$

```

## Function: `generate_user_otp`
```sql
CREATE OR REPLACE FUNCTION public.generate_user_otp(p_authtoken uuid, p_orgcode character varying, p_userids character varying[])
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_logged_user public.users%ROWTYPE;
BEGIN
    SELECT *
    INTO v_logged_user
    FROM public.users
    WHERE authtoken = p_authtoken
      AND orgcode = p_orgcode;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Invalid auth token');
    END IF;

    IF COALESCE(v_logged_user.isadmin, false) = false THEN
        RETURN json_build_object('success', false, 'message', 'Only admin user can manage OTPs');
    END IF;

    UPDATE public.users u
    SET otp = FLOOR(1000 + RANDOM() * 9000)::int
    FROM public.company c
    WHERE c.orgcode = u.orgcode
      AND c.orgcode = p_orgcode
      AND (p_userids IS NULL OR u.userid = ANY(p_userids))
      AND COALESCE(c.enableotp, false) = true
      AND COALESCE(u.isadmin, false) = false;

    RETURN json_build_object(
        'success', true,
        'message', 'OTPs reset successfully'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$function$

```

