# Cloudflare Workers migration notes (test deployment)

Target: `@opennextjs/cloudflare` on a free `*.workers.dev` URL. The domain `petnicstudio.com` is NOT touched.

## What changed and why
| File | Change | Why |
|---|---|---|
| `package.json` | Added `@opennextjs/cloudflare`, `wrangler`; `next` bumped to 16.4.6; removed unused `stripe`, `mongodb`, `pg`, `http-proxy`, `axios`; removed `packageManager` (repo uses npm); added `preview`/`deploy`/`upload` scripts | OpenNext 1.20.x needs next >=16.4.5; unused deps removed |
| `wrangler.jsonc` | Worker config: `nodejs_compat`, assets, R2 cache, D1 tag cache, DO queue, IMAGES binding, self-reference | Runtime + cache bindings |
| `open-next.config.ts` | R2 incremental cache, D1 tag cache, DO queue | `revalidate` + `revalidatePath` |
| `next.config.js` | `initOpenNextCloudflareForDev()` | Local bindings in `next dev` |
| `app/(routes)/blog/opengraph-image.js`, `shop/[category]/opengraph-image.js` | Removed `runtime = 'edge'` | Edge runtime is not used on Workers |
| `lib/rate-limit.js` | Prefers `CF-Connecting-IP` | Client-spoofable `x-forwarded-for` otherwise |
| `.gitignore`, `.dev.vars.example`, `public/_headers` | Cloudflare entries, env names, static asset caching | |

Unchanged on purpose: `app/api/ai-preview/route.js`, Stripe/PayPal logic, coupons, admin, Team, sitemap.

## One-time Cloudflare setup (you do this; I never see secrets)
```bash
npx wrangler login
npx wrangler r2 bucket create petnic-next-cache
npx wrangler d1 create petnic-next-tag-cache
```
Paste the returned `database_id` into `wrangler.jsonc`. Then create the tag table (check the OpenNext docs for the current schema command; the `deploy` step normally handles it).
R2 requires a payment method on the Cloudflare account. Durable Objects (SQLite) and a realistic CPU budget likely need **Workers Paid ($5/mo)**; Free allows 10 ms CPU per request.

## Environment variables
**Build-time** (Workers Builds -> Settings -> Build -> Variables and secrets; inlined into the bundle):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`

**Runtime secrets** (Worker -> Settings -> Variables and secrets):
`SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `PAYPAL_WEBHOOK_ID`, `CJ_ACCESS_TOKEN`, `AI_HORDE_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`

Note: the Supabase service-role value is also used at build time if any page reads data during `next build`; add it as a build variable if the build complains.

`NEXT_PUBLIC_SITE_URL`: the workers.dev URL is only known after the first deploy. Deploy once, copy the URL, set this build variable to it, and redeploy.

## Connect GitHub to Workers Builds
1. Push the `cloudflare` branch to GitHub (only when you decide).
2. Cloudflare dashboard -> Workers & Pages -> Create -> Import a repository -> pick the repo and the `cloudflare` branch.
3. Worker name: `petnic-cloudflare` (must match `wrangler.jsonc`).
4. Build command: `npx opennextjs-cloudflare build`; Deploy command: `npx opennextjs-cloudflare deploy`.
5. Add the build variables and runtime secrets above.
6. Save and deploy. Your URL is `https://petnic-cloudflare.<your-subdomain>.workers.dev`.

## Keep pointing at production
Live Stripe and PayPal webhooks must keep targeting `petnicstudio.com`. At domain switch time update: Stripe webhook endpoint, PayPal webhook endpoint (and `PAYPAL_WEBHOOK_ID` if a new one is created), Supabase auth redirect/site URL, `NEXT_PUBLIC_SITE_URL`, Google Search Console, and Brevo links.

## Rollback
Nothing here touches production. Delete the Worker, R2 bucket and D1 database, or simply don't merge the branch.
