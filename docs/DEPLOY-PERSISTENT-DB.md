# قاعدة بيانات دائمة لنسخة المعاينة

الحاوية تعمل افتراضياً بقاعدة Postgres مدمجة تُصفَّر عند كل تشغيل. للحفظ الدائم:

1. أنشئ مشروعاً على Neon أو Supabase (كلاهما يدعم `pgvector`) وفعّل الامتداد: `CREATE EXTENSION IF NOT EXISTS vector;`
2. انسخ رابط الاتصال (يبدأ بـ `postgresql://`) واحفظه كسر دون لصقه في أي محادثة:

```bash
printf '%s' 'رابط_الاتصال' | gcloud secrets create database-url --data-file=- --project wijaha
```

3. اربطه بالخدمة (يُمنح الحساب الافتراضي صلاحية القراءة أولاً):

```bash
gcloud secrets add-iam-policy-binding database-url --project wijaha \
  --member=serviceAccount:269097828743-compute@developer.gserviceaccount.com --role=roles/secretmanager.secretAccessor
gcloud run services update wijaha --project wijaha --region europe-west1 \
  --update-secrets DATABASE_URL=database-url:latest
```

عند وجود `DATABASE_URL` تتخطى الحاوية Postgres المدمج، وتشغّل `db:migrate` ثم `db:seed` (آمنان للتكرار) عند كل تشغيل. لا يُحدَّث نص قاعدة موجودة بالبذر؛ يُعدَّل من لوحة الإدارة أو بترحيل.

للإنتاج الحقيقي استعمل أيضاً: `NODE_ENV=production` مع مفاتيح `FIELD_ENCRYPTION_KEY` و`IP_HASH_SALT` و`SESSION_SECRET` ثابتة من Secret Manager، ومزوّد بريد ودفع حقيقيين.
