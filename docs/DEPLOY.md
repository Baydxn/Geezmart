# Deploying GEEZMART to Cloudflare

## The current error

```
Executing user deploy command: npx wrangler deploy
> WARNING You have run `wrangler deploy` on a Pages project
> ERROR   Missing entry-point to Worker script or to assets directory
```

`wrangler deploy` is the **Workers** command. GEEZMART is a **Pages** project,
so wrangler looks for a Worker script (`main = ...`) and finds none.

Nothing is wrong with the application code. The install step now succeeds
("added 86 packages"), so only the deploy command is at fault.

## Fix (dashboard)

**Workers & Pages -> geezmart -> Settings -> Builds & deployments**

| Field | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(leave empty)* |
| **Deploy command** | **clear it entirely** |

Then **Save** and **Retry deployment**.

If you would rather not clear the field, set it to:

```
npx wrangler pages deploy dist
```

`wrangler.toml` in this repo now also declares `[assets] directory = "./dist"`,
which makes the plain `npx wrangler deploy` command succeed as well. Clearing
the field is still the cleaner configuration.

## Environment variables

**Settings -> Environment variables** (set for BOTH Production and Preview):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ahijotxtncavfnhohxrw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |
| `NODE_VERSION` | `22` |

Never add a Supabase **service-role** key here. Anything in a
`NEXT_PUBLIC_*` / `VITE_*` variable is compiled into the JavaScript bundle and is
readable by every visitor.

The build fails loudly if one Supabase variable is present without the other,
which catches a `.env` saved with a UTF-8 BOM.

## After deploying

1. `https://your-domain/` should render the GEEZMART storefront.
2. `/admin` should show the admin login.
3. Deep links such as `/admin/products` only work because `public/_redirects`
   contains `/* /index.html 200`. Do not remove it.

## Applying the database

The schema lives in `supabase/` in the repository:

- `supabase/COMPLETE_SCHEMA.sql` -- **everything in one file, paste this**
- `supabase/migrations/0001..0007` -- the individual migrations
- `supabase/seed.sql` -- settings, shipping zones, navigation, homepage sections

Paste `COMPLETE_SCHEMA.sql` into the Supabase **SQL Editor -> New query** and
click Run. See `supabase/README.md` for the table-by-table breakdown.
