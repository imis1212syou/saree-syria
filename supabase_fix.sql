-- سعرلي سوريا: توحيد أعمدة وصلاحيات إدارة المتاجر والشركات
-- شغّل هذا الملف كاملًا من Supabase > SQL Editor

-- 1) أعمدة stores التي يستخدمها المشروع
alter table public.stores add column if not exists city text;
alter table public.stores add column if not exists area text;
alter table public.stores add column if not exists address text;
alter table public.stores add column if not exists phone text;
alter table public.stores add column if not exists whatsapp_url text;
alter table public.stores add column if not exists opening_hours text;
alter table public.stores add column if not exists working_days text;
alter table public.stores add column if not exists image_url text;
alter table public.stores add column if not exists company_id uuid;
alter table public.stores add column if not exists verified boolean not null default false;
alter table public.stores add column if not exists active boolean not null default true;

-- توافق مع أي كود قديم ما زال يستخدم company_name
alter table public.stores add column if not exists company_name text;

-- 2) جدول الشركات وأعمدته
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  whatsapp_url text,
  image_url text,
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.companies add column if not exists phone text;
alter table public.companies add column if not exists address text;
alter table public.companies add column if not exists whatsapp_url text;
alter table public.companies add column if not exists image_url text;
alter table public.companies add column if not exists verified boolean not null default false;
alter table public.companies add column if not exists active boolean not null default true;
alter table public.companies add column if not exists created_at timestamptz not null default now();
alter table public.companies add column if not exists updated_at timestamptz not null default now();

-- 3) علاقة المتجر بالشركة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_company_id_fkey'
  ) THEN
    ALTER TABLE public.stores
      ADD CONSTRAINT stores_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id)
      ON DELETE SET NULL;
  END IF;
END $$;

create index if not exists stores_company_id_idx on public.stores(company_id);
create index if not exists stores_verified_idx on public.stores(verified);
create index if not exists stores_active_idx on public.stores(active);

-- 4) توثيق التاجر
alter table public.profiles add column if not exists verified boolean not null default false;

-- 5) دالة المدير: SECURITY DEFINER حتى لا تمنع RLS فحص المدير نفسه
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(coalesce(p.role,'')) = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 6) RLS stores
alter table public.stores enable row level security;
drop policy if exists "public read active stores" on public.stores;
drop policy if exists "admin manage stores" on public.stores;
drop policy if exists "Admins can manage stores" on public.stores;

create policy "public read active stores"
on public.stores for select
to anon, authenticated
using (active = true or public.is_admin());

create policy "admin manage stores"
on public.stores for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 7) RLS companies
alter table public.companies enable row level security;
drop policy if exists "public read active companies" on public.companies;
drop policy if exists "admin manage companies" on public.companies;

create policy "public read active companies"
on public.companies for select
to anon, authenticated
using (active = true or public.is_admin());

create policy "admin manage companies"
on public.companies for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 8) RLS profiles: المدير يعدّل/يوثق التجار
alter table public.profiles enable row level security;
drop policy if exists "admin manage merchant profiles" on public.profiles;
create policy "admin manage merchant profiles"
on public.profiles for all
to authenticated
using (public.is_admin() or id = auth.uid())
with check (public.is_admin() or id = auth.uid());

-- 9) حذف متجر: يفك الارتباط ويحذف الأسعار ثم المتجر
create or replace function public.admin_delete_store(p_store_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'غير مسموح: المدير فقط يستطيع حذف المتجر';
  end if;

  update public.profiles
  set store_id = null, can_edit_prices = false
  where store_id = p_store_id;

  delete from public.price_listings where store_id = p_store_id;

  delete from public.stores where id = p_store_id;
  if not found then raise exception 'المتجر غير موجود'; end if;
end;
$$;
revoke all on function public.admin_delete_store(uuid) from public;
grant execute on function public.admin_delete_store(uuid) to authenticated;

-- 10) شركات: إضافة / تعديل / حذف
create or replace function public.admin_add_company(
  p_name text,
  p_phone text default null,
  p_address text default null,
  p_whatsapp_url text default null,
  p_image_url text default null,
  p_verified boolean default false
)
returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  if trim(coalesce(p_name,''))='' then raise exception 'اسم الشركة مطلوب'; end if;
  insert into public.companies(name,phone,address,whatsapp_url,image_url,verified,active)
  values(trim(p_name),p_phone,p_address,p_whatsapp_url,p_image_url,p_verified,true)
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.admin_add_company(text,text,text,text,text,boolean) to authenticated;

create or replace function public.admin_update_company(
  p_id uuid, p_name text, p_phone text default null, p_address text default null,
  p_whatsapp_url text default null, p_image_url text default null,
  p_verified boolean default false, p_active boolean default true
)
returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  update public.companies set name=trim(p_name),phone=p_phone,address=p_address,
    whatsapp_url=p_whatsapp_url,image_url=p_image_url,verified=p_verified,
    active=p_active,updated_at=now() where id=p_id;
  if not found then raise exception 'الشركة غير موجودة'; end if;
end $$;

grant execute on function public.admin_update_company(uuid,text,text,text,text,text,boolean,boolean) to authenticated;

create or replace function public.admin_delete_company(p_id uuid)
returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  update public.stores set company_id=null where company_id=p_id;
  delete from public.companies where id=p_id;
  if not found then raise exception 'الشركة غير موجودة'; end if;
end $$;

grant execute on function public.admin_delete_company(uuid) to authenticated;

-- 11) نشر schema cache
notify pgrst, 'reload schema';

-- 12) إعلانات الموقع: إدارة كاملة للمدير وقراءة الإعلانات النشطة للعامة
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text,
  image_url text,
  target_url text,
  button_text text not null default 'عرض الإعلان',
  ad_type text not null default 'banner' check (ad_type in ('banner','store','product','company','custom')),
  placement text not null default 'all' check (placement in ('all','home_top','stores_top','store_detail')),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ads add column if not exists ad_type text not null default 'banner';

alter table public.ads enable row level security;
drop policy if exists "public read active ads" on public.ads;
drop policy if exists "admin manage ads" on public.ads;

create policy "public read active ads"
on public.ads for select
to anon, authenticated
using (active = true and start_at <= now() and (end_at is null or end_at >= now()));

create policy "admin manage ads"
on public.ads for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  if not exists (select 1 from pg_constraint where conname='ads_ad_type_check') then
    alter table public.ads add constraint ads_ad_type_check check (ad_type in ('banner','store','product','company','custom'));
  end if;
end $$;

create index if not exists ads_active_dates_idx on public.ads(active,start_at,end_at);
create index if not exists ads_placement_idx on public.ads(placement);

notify pgrst, 'reload schema';
