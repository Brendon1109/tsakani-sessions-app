# Staging Environment

The Vercel Hobby tier does not offer a separate "staging" project, but it does
auto-deploy preview URLs for every git branch. We use that as staging.

## Workflow

1. **`master` branch** → Production (https://tsakani-sessions-app.vercel.app)
2. **`develop` branch** → Preview URL (changes on each push)
3. **Feature branches** (`feat/xyz`) → Individual preview URLs per branch

## Workflow for changes

```bash
# Start a feature branch from develop
git checkout develop
git pull
git checkout -b feat/my-feature

# ...make changes, commit...

# Push: Vercel auto-creates a preview URL
git push -u origin feat/my-feature

# Merge to develop for broader testing
git checkout develop
git merge feat/my-feature
git push  # Vercel preview URL for `develop` is updated

# When ready, merge to master
git checkout master
git merge develop
git push  # Triggers production deploy
```

## Environment variables

Vercel env vars have three "environments": Production, Preview, Development.
- Production vars are only used on `master`.
- Preview vars are used for all other branches.
- Development vars are used via `vercel dev` locally.

For staging, use **Preview** env vars pointing at a separate Supabase project
(free tier allows 2 projects per org). This gives you:
- `master` → prod Supabase project (`gryssobrndqukwnjyosf`)
- `develop` → staging Supabase project (create a second one)

Without a second Supabase, you can still use preview URLs but they'll share
data with production. Safer option is to create a staging Supabase project
when needed.

## Git author config (IMPORTANT)

Deployments are blocked on the Hobby plan if the commit author isn't
recognised by Vercel. Always use the GitHub no-reply email for this repo:

```bash
git config user.name "Brendon1109"
git config user.email "115246977+Brendon1109@users.noreply.github.com"
```

Never use BrendonM96 — that account isn't linked to the Vercel team.
