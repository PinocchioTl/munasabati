## Munasabati Booking — Public multi-tenant booking platform

A new public-facing booking surface on the same app, sharing the existing Supabase backend with Munasabati Manager. Each business owner gets a unique public URL `/booking/<slug>` that shows only their decorations, supplies, prices, and availability, and lets end-customers submit booking requests that land directly in the owner's Manager dashboard.

### 1. Database changes (one migration)

Add fields to `profiles` (owner = tenant):
- `public_slug` text unique — URL identifier (e.g. `yasser-events`)
- `cover_url` text — cover image
- `tagline` text — short description
- `booking_enabled` boolean default true
- `show_prices` boolean default true
- `description` text — about section

Add `decorations.description` text (already in `db.ts` interface but not in DB).

New table `booking_requests` (separate from internal `bookings` until owner accepts):
- `id`, `owner_id` (tenant), `created_at`
- `customer_name`, `customer_phone`, `event_date`, `event_location`, `event_type`, `notes`
- `decoration_ids uuid[]`, `supply_ids uuid[]` (with quantities as jsonb)
- `status`: `new | reviewing | accepted | confirmed | completed | cancelled`
- `booking_id` uuid nullable — link once converted to a real booking

RLS:
- `profiles`: add a permissive SELECT policy for `anon` & `authenticated` limited to public booking columns via a view `public_owners` (slug, company_name, logo, cover, colors, tagline, description, show_prices, booking_enabled).
- `decorations` / `supplies`: add `SELECT` policy for `anon` allowed only when fetched via a server function with `supabaseAdmin` (keep RLS user-only and use server fn). **Chosen approach: server functions with `supabaseAdmin`, scoped by slug → owner_id**, so no anon RLS opening.
- `booking_requests`: `INSERT` allowed via server function only (admin client); owner reads own rows via `auth.uid() = owner_id`.

GRANTs follow the standard pattern.

### 2. Server functions (`src/lib/booking-public.functions.ts`)

All use `supabaseAdmin` (lazy import inside handler), scoped by `slug`:
- `getPublicOwner({ slug })` → owner branding & settings (404 if disabled)
- `getPublicDecorations({ slug })` → owner's decorations
- `getPublicSupplies({ slug })` → owner's supplies
- `getDecorationAvailability({ slug, decorationId, date })` → checks `booking_decorations` × confirmed/pending bookings for that date
- `submitBookingRequest({ slug, ...payload })` → validates with Zod, inserts into `booking_requests`, inserts a notification for owner

### 3. Public routes (no auth, SSR-friendly, top-level)

- `src/routes/booking.$slug.tsx` — landing: logo, cover, tagline, CTAs
- `src/routes/booking.$slug.decorations.tsx` — grid with images/prices/details
- `src/routes/booking.$slug.supplies.tsx` — supplies grid
- `src/routes/booking.$slug.decorations.$id.tsx` — detail w/ gallery, availability check, "Request booking"
- `src/routes/booking.$slug.request.tsx` — full booking request form (name, phone, date, location, event type, items, notes)

Each route uses `head()` with company name + tagline. Loaders call public server fns. Mobile-first layout reusing the brand tokens (`#5D0A13` / `#D4AF37`).

### 4. Manager additions

- `src/components/BookingSettings.tsx` + tab inside `_main.settings.tsx`: slug, cover upload (uses `branding` bucket), tagline/description, toggles (booking_enabled, show_prices), shareable URL with copy button.
- `_main.bookings.tsx`: add a "طلبات جديدة" section/badge that shows `booking_requests` with status `new/reviewing`, with actions (accept → creates real booking & marks accepted, reject → cancelled).
- Notifications already trigger via insert into `notifications`.

### 5. Branding

Public pages read each owner's `profiles` colors and apply them via inline CSS variables on a wrapper (don't pollute global theme since it's per-tenant URL).

### Technical details

- Tenant resolution: every public server fn does `select id from profiles where public_slug=$slug and booking_enabled=true`.
- Availability formula: for each requested decoration on `event_date`, sum `qty` from `booking_decorations` joined with `bookings` where `status IN ('pending','confirmed','in_progress')` and `event_date = X`; available = `total_qty - sum`.
- Slug validation: lowercase a-z0-9 and `-`, 3–40 chars, unique.
- Request form uses Zod, no PII in public-readable tables (only owner sees requests via RLS).
- Reuses existing `clients` table only on owner-side acceptance (creates client if phone not matched).
