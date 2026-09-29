# دوال Supabase المستخدمة في النسخة المدمجة

هذه النسخة تعتمد على دوال Supabase التي تم تجهيزها في المحادثة السابقة، ولا تغيّر مفاتيح الاتصال الموجودة في `index.html`.

دوال ربط الشركات والصلاحيات:
- `admin_link_company_user_by_email`
- `admin_set_company_permissions_v2`
- `admin_list_company_users_v2`
- `admin_unlink_company_user`

إحصائيات الشركات:
- `company_owner_visitor_stats`
- `record_company_visit`

دوال نظام منتجات الشركات الموجودة في النظام الأصلي:
- `company_add_product`
- `company_update_product`
- `company_delete_product`
- `company_add_category`
- `company_toggle_category`

ملاحظة: هذه النسخة تعرض إجمالي الزيارات فقط، ولا تعرض الزوار الفريدين.
