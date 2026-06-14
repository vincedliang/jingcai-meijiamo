-- Replace CHANGE_ME_BEFORE_RUNNING with the current shared app passcode before
-- running this file in Supabase SQL Editor.

update auth.users set
  email = case id
    when '10000000-0000-0000-0000-000000000001' then 'wang-sen@jingcai-meijiamo.com'
    when '10000000-0000-0000-0000-000000000002' then 'yang-yuheng@jingcai-meijiamo.com'
    when '10000000-0000-0000-0000-000000000004' then 'wang-xiaoming@jingcai-meijiamo.com'
    when '10000000-0000-0000-0000-000000000005' then 'bi-yixin@jingcai-meijiamo.com'
    when '10000000-0000-0000-0000-000000000006' then 'zhao-wenxuan@jingcai-meijiamo.com'
    when '10000000-0000-0000-0000-000000000007' then 'liang-dongxu@jingcai-meijiamo.com'
  end,
  encrypted_password = case id
    when '10000000-0000-0000-0000-000000000001' then crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf'))
    when '10000000-0000-0000-0000-000000000002' then crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf'))
    when '10000000-0000-0000-0000-000000000004' then crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf'))
    when '10000000-0000-0000-0000-000000000005' then crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf'))
    when '10000000-0000-0000-0000-000000000006' then crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf'))
    when '10000000-0000-0000-0000-000000000007' then crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf'))
  end,
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  confirmation_token = '',
  recovery_token = '',
  email_change = '',
  raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
  updated_at = now()
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007'
);

delete from auth.identities
where user_id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007'
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at) values
(gen_random_uuid(), '10000000-0000-0000-0000-000000000001', 'wang-sen@jingcai-meijiamo.com', '{"sub":"10000000-0000-0000-0000-000000000001","email":"wang-sen@jingcai-meijiamo.com","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now()),
(gen_random_uuid(), '10000000-0000-0000-0000-000000000002', 'yang-yuheng@jingcai-meijiamo.com', '{"sub":"10000000-0000-0000-0000-000000000002","email":"yang-yuheng@jingcai-meijiamo.com","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now()),
(gen_random_uuid(), '10000000-0000-0000-0000-000000000004', 'wang-xiaoming@jingcai-meijiamo.com', '{"sub":"10000000-0000-0000-0000-000000000004","email":"wang-xiaoming@jingcai-meijiamo.com","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now()),
(gen_random_uuid(), '10000000-0000-0000-0000-000000000005', 'bi-yixin@jingcai-meijiamo.com', '{"sub":"10000000-0000-0000-0000-000000000005","email":"bi-yixin@jingcai-meijiamo.com","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now()),
(gen_random_uuid(), '10000000-0000-0000-0000-000000000006', 'zhao-wenxuan@jingcai-meijiamo.com', '{"sub":"10000000-0000-0000-0000-000000000006","email":"zhao-wenxuan@jingcai-meijiamo.com","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now()),
(gen_random_uuid(), '10000000-0000-0000-0000-000000000007', 'liang-dongxu@jingcai-meijiamo.com', '{"sub":"10000000-0000-0000-0000-000000000007","email":"liang-dongxu@jingcai-meijiamo.com","email_verified":true,"phone_verified":false}'::jsonb, 'email', now(), now(), now());
