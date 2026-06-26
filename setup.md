# Graduation Invite Platform — Setup Guide

This is a one-time setup. Once it's done, everything runs automatically
and you never need to touch it again.

---

## What you're setting up

- **Netlify** — hosts your website and runs the code (free)
- **Supabase** — stores each buyer's invite data (free)
- **Cloudinary** — stores the photos buyers upload (free)

Total cost: $0/month until you have hundreds of buyers.

---

## Step 1 — Create a Supabase account and database

1. Go to supabase.com and sign up for free
2. Click "New project" — name it anything (e.g. "graduation-invites")
3. Once it's created, click **SQL Editor** in the left sidebar
4. Paste this and click Run — it creates the table that stores invite data:

```sql
create table invites (
  id              bigint generated always as identity primary key,
  slug            text unique not null,
  first_name      text,
  last_name       text,
  high_school     text,
  class_year      text,
  event_date      text,
  event_time      text,
  cal_start       text,
  cal_end         text,
  location        text,
  rsvp_phone      text,
  rsvp_email      text,
  rsvp_message    text,
  hero_image      text,
  gallery_images  text[],
  created_at      timestamptz default now()
);
```

5. Go to **Project Settings → API**
6. Copy these two values — you'll need them in Step 3:
   - **Project URL** (looks like https://abcdefgh.supabase.co)
   - **service_role key** (under "Project API keys" — use service_role, not anon)

---

## Step 2 — Create a Cloudinary account

1. Go to cloudinary.com and sign up for free
2. On your dashboard, find your **Cloud name** (top left) — copy it
3. Go to **Settings → Upload**
4. Scroll to "Upload presets" and click "Add upload preset"
5. Set:
   - Preset name: `graduation_invites`
   - Signing mode: **Unsigned**
6. Click Save
7. Copy the preset name: `graduation_invites`

---

## Step 3 — Deploy to Netlify

1. Go to netlify.com and sign up for free
2. Click "Add new site" → "Deploy manually"
3. Drag your entire project folder onto the deploy box
4. Wait for it to deploy (about 30 seconds)
5. Go to **Site settings → Environment variables** and add these:

| Key                      | Value                              |
|--------------------------|------------------------------------|
| SUPABASE_URL             | (your Supabase Project URL)        |
| SUPABASE_SERVICE_KEY     | (your Supabase service_role key)   |
| CLOUDINARY_CLOUD         | (your Cloudinary cloud name)       |
| CLOUDINARY_PRESET        | graduation_invites                 |

6. Go to **Deploys** and click "Trigger deploy → Deploy site"
   (This redeploys with your new environment variables active)

---

## Step 4 — Rename your site (optional but recommended)

1. In Netlify, go to **Site settings → General → Site name**
2. Change it to something like `graduateinvites` or your brand name
3. Your site will now be at `graduateinvites.netlify.app`

---

## Step 5 — Test it

1. Go to your Netlify URL (e.g. `graduateinvites.netlify.app`)
2. Fill in the form with fake info
3. Upload a test photo
4. Click "Build my invite"
5. You should get a link like `graduateinvites.netlify.app/invite/test-name-2026`
6. Open that link and confirm the invite looks right

---

## What to give buyers on Etsy/Gumroad

After they purchase, send them this message (edit as needed):

---

Thank you so much! 🎓

Here's your link to create your personalised graduation invite:
**[YOUR NETLIFY URL]**

Just fill in the form, upload your photos, and you'll get your
unique shareable link in seconds. No technical knowledge needed!

If you run into any issues, just message me here.

---

## Troubleshooting

**Photos aren't uploading**
→ Double-check your Cloudinary cloud name and preset name in Netlify's environment variables. Make sure the preset is set to "Unsigned."

**The invite page says "not found"**
→ The Supabase table may not have been created. Go back to Step 1 and run the SQL again.

**Functions aren't working after re-deploying**
→ In Netlify, go to Deploys → Trigger deploy → Deploy site. This forces a fresh build.