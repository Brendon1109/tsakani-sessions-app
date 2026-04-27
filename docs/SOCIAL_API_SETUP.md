# Social Media API Setup Guide

**For:** A team member setting up TikTok and Instagram auto-posting for Tsakani Sessions.

**Time needed:** 2-4 hours of active work spread across 2-4 weeks of waiting for reviews.

**What you'll end up with:** Six values that Brendon pastes into the app, enabling one-click posting from admin.

---

## Before you start — gather these

| Item | Where to get |
|---|---|
| Tsakani Sessions email address | `tsakanisessions@gmail.com` (already in use) |
| Tsakani Sessions phone number | `+27 76 996 1477` |
| Live website URL | `https://tsakani-sessions-app.vercel.app` |
| Tsakani logo (square, 1024×1024 PNG) | Brendon — he has the source file |
| ID document of a team member | For Meta business verification |
| A Facebook account | Personal — used to create the business page |

---

# Part A — Instagram Graph API

## Step 1 · Create Tsakani's Facebook Page (15 min)

1. Sign in to Facebook with `tsakanisessions@gmail.com` or your personal account.
2. Go to <https://facebook.com/pages/create>.
3. Page name: `Tsakani Sessions`.
4. Category: `Music & Audio` → pick `Musician/Band`.
5. Bio: `Two Tales of Happiness, Friendship & Brotherhood. Premium DJ entertainment and content creation — Cape Town.`
6. Click **Create Page**.
7. Add the Tsakani logo as profile picture, a good event photo as cover.
8. **Write down the Page ID:** on the Page → About → Page Transparency → Page ID. Looks like `123456789012345`.

## Step 2 · Convert Instagram to Business account (5 min)

1. Open Instagram app on your phone → log in as `@tsakani_sessions`.
2. Menu (☰) → **Settings and privacy** → **Account type and tools** → **Switch to professional account**.
3. Choose **Creator** (not Business — Creator has fewer restrictions and still supports API posting).
4. Category: `Musician`.
5. Finish the setup.

## Step 3 · Link Instagram to the Facebook Page (5 min)

1. Still on Instagram, go to **Settings** → **Account type and tools** → **Share to other apps** → **Facebook**.
2. Tap **Connect Account** and pick the **Tsakani Sessions** Page.
3. Allow all permissions.
4. Back on Facebook (in browser), go to the Tsakani Sessions Page → **Settings** → **Linked Accounts** → confirm Instagram is connected.

## Step 4 · Create a Meta Developer App (20 min)

1. Go to <https://developers.facebook.com>.
2. Top-right → **My Apps** → **Create App**.
3. Use case: **Other**.
4. App type: **Business**.
5. App name: `Tsakani Sessions Web`.
6. App contact email: `tsakanisessions@gmail.com`.
7. Business portfolio: create a new one called `Tsakani Sessions`.
8. Click **Create App**.

## Step 5 · Add the Instagram Graph API product (5 min)

1. In your new app dashboard, left sidebar → **Add Products**.
2. Find **Instagram Graph API** → **Set up**.
3. Also add **Facebook Login for Business** (required for the auth flow).

## Step 6 · Get a long-lived User access token (15 min)

1. Left sidebar → **Tools** → **Graph API Explorer**.
2. Top-right dropdown: select your app (`Tsakani Sessions Web`).
3. Click **Generate Access Token** → sign in → **approve all permissions requested**.
4. Click **Get Token** → **Get User Access Token** → check these boxes:
   - `pages_show_list`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
5. Copy the short-lived token that appears in the field.
6. Below the token, click the **i** (info) icon → **Open in Access Token Debugger**.
7. Scroll to the bottom → click **Extend Access Token**.
8. **Copy the long-lived token (lasts ~60 days).** Save it somewhere safe.

## Step 7 · Find the Instagram Business Account ID (5 min)

1. Back in Graph API Explorer, paste this in the query bar and click **Submit**:
   ```
   GET /me/accounts
   ```
2. You'll see a list of Pages. Find **Tsakani Sessions** and copy its `id`.
3. Now run:
   ```
   GET /{PAGE_ID}?fields=instagram_business_account
   ```
   (replace `{PAGE_ID}` with the ID from step 2)
4. The response contains `instagram_business_account: { id: "..." }`. **Copy that id — that's what we need.**

## Step 8 · Submit for App Review (30 min + ~1 week wait)

1. Left sidebar → **App Review** → **Permissions and Features**.
2. Request these:
   - `instagram_basic`
   - `instagram_content_publish`
3. For each, click **Request Advanced Access**. It will ask:
   - **Use case explanation**: paste this:
     > Tsakani Sessions is a Cape Town-based DJ entertainment brand. We use
     > Instagram Graph API from our admin dashboard at
     > tsakani-sessions-app.vercel.app to publish event photos, Reels, and
     > announcements to our official Instagram account
     > (@tsakani_sessions). Only admins can trigger posts.
   - **Screencast** (upload a short video showing the admin clicking "Post to Instagram" in our admin panel). Brendon can record this once the UI is built. Let him know when you reach this step.
   - **Privacy Policy URL**: `https://tsakani-sessions-app.vercel.app/privacy` (Brendon will add this page).
4. Submit. Meta reviews in 3-10 business days.

## Step 9 · Send Brendon these 2 values

Once everything above is done:

```
INSTAGRAM_ACCESS_TOKEN=<the long-lived token from step 6>
INSTAGRAM_ACCOUNT_ID=<the id from step 7>
```

---

# Part B — TikTok Content Posting API

## Step 1 · Create TikTok Developer account (10 min)

1. Go to <https://developers.tiktok.com>.
2. Top-right → **Sign up**. Use `tsakanisessions@gmail.com`.
3. Verify email → complete profile.
4. When asked for a TikTok account to connect, use **@tsakani_sessions**.

## Step 2 · Apply for developer access (5 min)

1. Dashboard → **Apply for developer access**.
2. Fill in:
   - Company: `Tsakani Sessions`
   - Website: `https://tsakani-sessions-app.vercel.app`
   - Industry: `Media & Entertainment`
   - Country: `South Africa`
3. Wait for email approval (usually 1-2 business days).

## Step 3 · Create a TikTok app (15 min)

1. Once approved, go to **Manage apps** → **Create an app**.
2. Fill in:
   - App name: `Tsakani Sessions`
   - App description: `Internal admin tool for the Tsakani Sessions DJ brand. Posts event aftermovies and short clips to our official TikTok account from our admin dashboard.`
   - Category: `Media & Entertainment`
   - Platforms: **Web**.
   - Web URL: `https://tsakani-sessions-app.vercel.app`
   - Privacy policy URL: `https://tsakani-sessions-app.vercel.app/privacy`
   - Terms of service URL: `https://tsakani-sessions-app.vercel.app/terms`
3. Upload the Tsakani logo (1024×1024 PNG).
4. Click **Save & Continue**.

## Step 4 · Add the Content Posting API product (10 min)

1. In your app → **Add products**.
2. Find **Content Posting API** → **Add**.
3. Configure:
   - **Redirect URI**: `https://tsakani-sessions-app.vercel.app/api/tiktok/callback`
   - **Scopes to request**: `user.info.basic`, `video.upload`, `video.publish`

## Step 5 · Apply for Content Posting API access (30 min + ~2 week wait)

This is the long step. TikTok reviews carefully.

1. On your app dashboard → **Content Posting API** → **Submit for Review**.
2. Fill out:
   - **Use case category**: `Content creator tools`
   - **Business description**: paste this:
     > Tsakani Sessions is a Cape Town-based DJ entertainment and content
     > creation brand. Our admin dashboard at tsakani-sessions-app.vercel.app
     > lets team members (only) post event highlights, DJ clips, and short-form
     > content to our official TikTok account @tsakani_sessions. This automates
     > what we currently do by hand. Only authenticated admin users of our
     > dashboard can trigger posts.
   - **Demo video**: upload a 60-second screen recording showing the admin
     panel's "Post to TikTok" button being clicked (tell Brendon when you
     reach this step — he'll record it).
   - **Number of users**: 5 (the Tsakani team).
3. Submit.
4. TikTok reviews in 7-14 days. You'll get an email with approval or follow-up questions.

## Step 6 · Get Client Key and Client Secret

Available immediately after you create the app (not after review).

1. Dashboard → your app → **Basic information**.
2. You'll see:
   - **Client Key** (sometimes labelled "Client ID")
   - **Client Secret**
3. **Copy both. Keep the secret in a password manager.**

## Step 7 · OAuth flow to get an access token

This must be done once review is approved.

1. Visit this URL in your browser (replace `{CLIENT_KEY}`):
   ```
   https://www.tiktok.com/v2/auth/authorize/?client_key={CLIENT_KEY}&scope=user.info.basic,video.upload,video.publish&response_type=code&redirect_uri=https://tsakani-sessions-app.vercel.app/api/tiktok/callback
   ```
2. Sign in with **@tsakani_sessions** → authorize.
3. You'll be redirected to a URL like:
   ```
   https://tsakani-sessions-app.vercel.app/api/tiktok/callback?code=ABC123...
   ```
4. **Copy the `code` value** from the URL.
5. Tell Brendon — he'll exchange it for a long-lived access token and paste it into the app.

## Step 8 · Send Brendon these 3 values

```
TIKTOK_CLIENT_KEY=<from step 6>
TIKTOK_CLIENT_SECRET=<from step 6>
TIKTOK_OAUTH_CODE=<from step 7, only valid for 60 seconds — send immediately>
```

---

# What Brendon does with these values

Once you send him the six values (2 from Instagram, 3 from TikTok + the Tsakani logo confirmation), he adds them to the app's environment variables on Vercel in 5 minutes, and the "Post to TikTok" / "Post to Instagram" buttons in admin start working.

---

# Common issues & how to fix

| Problem | Fix |
|---|---|
| "This app needs business verification" (Meta) | Meta Business Suite → Security Center → Start verification. Upload your ID + a utility bill. 1-3 day review. |
| Instagram account won't switch to Business | Your IG account must be public. Switch public first, then switch to business. |
| TikTok says "Your app doesn't meet requirements" | Make sure privacy policy + terms URLs actually work. Create placeholder pages if needed — tell Brendon. |
| Access token expires in 1 hour | You used a short-lived token. Go back to Step 6 of Instagram, or use the Token Debugger to extend. |
| Developer portal rejects your account | Respond to their email with a clearer business description. Emphasise we post to our OWN account, not other people's. |

---

# Summary checklist

Print this out. Tick each as you go.

**Instagram:**
- [ ] Facebook Page created
- [ ] Instagram switched to Creator
- [ ] Instagram linked to Facebook Page
- [ ] Meta Developer app created
- [ ] Instagram Graph API product added
- [ ] Long-lived token generated
- [ ] Instagram Business Account ID captured
- [ ] Permissions submitted for review
- [ ] Token + ID sent to Brendon

**TikTok:**
- [ ] TikTok Developer account approved
- [ ] App created
- [ ] Content Posting API product added
- [ ] App submitted for review
- [ ] Client Key + Secret saved
- [ ] (After approval) OAuth code captured
- [ ] Key, Secret, Code sent to Brendon

---

Questions while doing this? WhatsApp Brendon: **+27 76 996 1477**
