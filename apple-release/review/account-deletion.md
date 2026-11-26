# حذف الحساب — وجاهة

داخل التطبيق: القائمة ← «الحساب» (`/account`) ← «طلب حذف الحساب (مهلة 14 يوماً)» ← «تأكيد جدولة الحذف».
يرسل الطلب `POST /api/account/delete`، ويُسجَّل الخروج فورًا، ويُحذف الحساب بعد مهلة 14 يومًا.

**For App Review (EN):** Menu → Account → "Schedule Account Deletion (14-day grace)" → confirm. The user is signed out immediately; deletion completes after 14 days.
