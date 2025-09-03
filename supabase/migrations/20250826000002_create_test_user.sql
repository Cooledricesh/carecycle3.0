-- ⚠️  SECURITY WARNING: Test user migration with hardcoded credentials
-- ⚠️  FOR DEVELOPMENT/TESTING ONLY - NEVER USE IN PRODUCTION!
-- 
-- Original credentials (COMMENTED OUT FOR SECURITY):
-- Email: admin@test.com
-- Password: admin123
--
-- 🔧 RECOMMENDED ACTION: Use create-admin-secure.js script instead:
-- node create-admin-secure.js
--
-- If you need to enable this migration for testing, uncomment the code block below

/*
BEGIN;

-- First ensure we have a proper admin user
DO $$
DECLARE
    test_user_id uuid;
BEGIN
    -- Create the auth user if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@test.com') THEN
        -- Insert into auth.users
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            is_sso_user,
            deleted_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            'admin@test.com',
            crypt('admin123', gen_salt('bf')),
            NOW(),
            '',
            '',
            '',
            '',
            '{"provider": "email", "providers": ["email"]}',
            '{"name": "Admin User"}',
            NOW(),
            NOW(),
            false,
            NULL
        ) RETURNING id INTO test_user_id;

        -- Create the profile
        INSERT INTO public.profiles (
            id,
            email,
            name,
            role,
            approval_status,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            test_user_id,
            'admin@test.com',
            'Admin User',
            'admin',
            'approved',
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Test admin user created successfully. Email: admin@test.com, Password: admin123';
    ELSE
        -- Update the existing user's password
        UPDATE auth.users 
        SET encrypted_password = crypt('admin123', gen_salt('bf'))
        WHERE email = 'admin@test.com'
        RETURNING id INTO test_user_id;
        
        -- Ensure profile exists
        INSERT INTO public.profiles (
            id,
            email,
            name,
            role,
            approval_status,
            is_active
        ) VALUES (
            test_user_id,
            'admin@test.com',
            'Admin User',
            'admin',
            'approved',
            true
        )
        ON CONFLICT (id) DO UPDATE
        SET approval_status = 'approved',
            is_active = true,
            role = 'admin';
            
        RAISE NOTICE 'Test admin user password reset. Email: admin@test.com, Password: admin123';
    END IF;
END $$;

COMMIT;
*/

-- 📝 Migration disabled for security reasons
-- Use create-admin-secure.js script to create admin users safely