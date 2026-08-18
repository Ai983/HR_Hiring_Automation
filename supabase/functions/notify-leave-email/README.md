# notify-leave-email — setup

Sends the leave-request email to **ea@hagerstone.com** and **systems@hagerstone.com**
from **systems@hagerstone.com**, replacing the Google Form / Apps Script mail.

Triggered by `src/services/emailService.js` from the attendance portal, right
after the `leave_requests` row is inserted.

## 1. Generate the app password

The Gmail SMTP server won't take the normal account password.

1. Sign in to Google as **systems@hagerstone.com**
2. Google Account → Security → **2-Step Verification** (must be ON)
3. Security → **App passwords** → name it `Hagerstone Hub` → **Create**
4. Copy the 16-character password (shown once, spaces don't matter)

If **App passwords** is missing from the page, Workspace admin has disabled
"Less secure app access / app passwords" for the org — an admin has to allow it
in admin.google.com → Security → Access and data control → Less secure apps.

## 2. Set the secrets

Run against the **hub** project `tpfvnerrjhqwipyonngf` — the one holding the `hr`
schema. *Not* `sgerslbmnwrltqrhsdir` in the repo's `.env`; that's the older
HireFlow project and has no `hr` schema or `leave_requests` table, so a function
deployed there would never be called.

```bash
supabase secrets set \
  SMTP_USER=systems@hagerstone.com \
  SMTP_PASS='xxxxxxxxxxxxxxxx' \
  --project-ref tpfvnerrjhqwipyonngf
```

| Secret | Required | Purpose |
|---|---|---|
| `SMTP_USER` | yes | Sending account — also the `From:` address |
| `SMTP_PASS` | yes | 16-char app password from step 1 |
| `HUB_URL` | **yes** | Base URL for the "Click Here" link — must be **`https://hr-hiring-automation.vercel.app`**, this app, where the Leave Requests panel lives. Do *not* rely on the hub's existing `HUB_PUBLIC_URL`: that points at `hagerstone-hub.vercel.app`, a separate app on the same database with no leave panel, so approvers would land nowhere. `HUB_URL` is read first precisely so it can override it. |
| `LEAVE_MAIL_TO` | no | CSV to override recipients, e.g. `ea@hagerstone.com,systems@hagerstone.com,hr@hagerstone.com` |
| `SMTP_HOST` / `SMTP_PORT` | no | Default `smtp.gmail.com` / `465`. Only needed if you move off Google. |

## 3. Deploy

```bash
supabase functions deploy notify-leave-email --project-ref tpfvnerrjhqwipyonngf
```

Leave JWT verification **on** (the default) — it's what stops anyone who isn't a
signed-in employee from triggering a send.

## 4. Test

Apply for a test leave from the portal, then check both inboxes. If nothing
arrives:

```bash
supabase functions logs notify-leave-email --project-ref tpfvnerrjhqwipyonngf
```

| Log message | Cause |
|---|---|
| `SMTP_USER / SMTP_PASS are not configured` | Step 2 wasn't run, or was run against the wrong project |
| `535 Username and Password not accepted` | Using the account password instead of the app password, or the app password was revoked |
| `Invalid login ... BadCredentials` | 2-Step Verification is off on systems@hagerstone.com |

Nothing here can break leave submission — the portal fires this call
fire-and-forget and ignores the outcome, so a mail failure still leaves the
request saved and the WhatsApp notifications sent.

## Notes

- **`End Date::`** — the double colon is copied verbatim from the original Apps
  Script template so the mail matches what HR has been reading for years. Remove
  one colon in `buildBody()` if you'd rather have it fixed.
- The Hindi leave-type labels are duplicated in `index.ts` from
  `src/leaveConfig.js` (edge functions can't import from `src/`). If you add a
  leave type, add it in both places — an unknown type falls back to printing the
  raw stored value rather than failing.
