-- سعرلي سوريا
-- عمود مستقل تماماً لواتساب صاحب الموقع والداعمين.
-- لا يعتمد على key ولا يتداخل مع روابط المتاجر أو المنتجات.

alter table public.site_settings
  add column if not exists owner_supporters_data jsonb;

-- البيانات داخل العمود تكون بهذا الشكل:
-- {
--   "owner_whatsapp_url": "https://wa.me/963...",
--   "supporters": [
--     {
--       "id": "supporter_...",
--       "name": "اسم الداعم",
--       "description": "وصف اختياري",
--       "image_url": "https://...",
--       "sort_order": 0,
--       "visible": true
--     }
--   ]
-- }
