-- سعرلي سوريا
-- إضافة عمودي حفظ مستقلين لروابط صاحب الموقع.
-- لا يحذف ولا يغير أي عمود أو ميزة أخرى.

alter table public.site_settings
  add column if not exists owner_whatsapp_url text;

alter table public.site_settings
  add column if not exists owner_telegram_url text;
