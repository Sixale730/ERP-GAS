# CUANTY — ERP for Mexican SMBs

Full-stack ERP covering inventory, sales, point of sale, purchasing, and Mexican electronic invoicing (CFDI 4.0). Built as a custom system for one client and **running in production** at [cuanty.cloud](https://www.cuanty.cloud). Product UI is in Spanish (built for the Mexican market).

**Stack:** Next.js 14 (App Router) · TypeScript · Ant Design 5 · TanStack React Query v5 · Zustand · Supabase (PostgreSQL) · PWA

---

## What it does

| Module | Highlights |
|---|---|
| **Inventory** | Multi-warehouse stock, movement history, auditable bulk adjustments, reorder points |
| **Sales pipeline** | Quote → sales order → invoice, with per-client price lists and over-sell alerts |
| **E-invoicing (CFDI 4.0)** | XML generation, PAC stamping, cancellation, payment complements — fully automated (see below) |
| **Point of sale** | Cash-register terminal with shift open/close, reconciliation ("cortes"), scale integration |
| **Purchasing** | Purchase orders, partial receiving, automatic PO suggestions that account for in-transit stock |
| **Reporting** | ~45 reports (sales, inventory, finance, tax, purchasing, POS) with Excel/PDF export |
| **Insights engine** | 15 configurable rules that scan ERP data and raise actionable alerts (overdue receivables, dead stock, declining customers…) |
| **Access control** | Google OAuth, invitation flow, 5 roles with per-user permission overrides (JSONB) |

## CFDI 4.0 e-invoicing (the interesting part)

Mexican electronic invoices are XML documents that must be digitally sealed and stamped by an authorized provider (PAC) under strict SAT rules. CUANTY automates the entire flow:

1. Builds the CFDI 4.0 XML from invoice data (`xmlbuilder2`).
2. Sends it to the Finkok PAC over SOAP (`sign_stamp` — seal + stamp in one call).
3. Stores the fiscal UUID, stamped XML, and a generated PDF (jsPDF) with the SAT QR code.

Also handled: **payment complements 2.0** (for installment payments), **cancellation** against SAT, CSD certificate upload/parsing (`node-forge`), retry of failed stamps, and a catalog that translates raw SAT/PAC error codes into messages a human can act on. Payment methods use the official SAT `c_FormaPago` catalog codes.

Code lives in [`src/lib/cfdi/`](src/lib/cfdi/) and [`src/app/api/cfdi/`](src/app/api/cfdi/).

## Engineering notes

- **Server state vs. client state:** all server data goes through React Query (5-min stale time, optimistic updates); UI and POS state live in two persisted Zustand stores with atomic selectors.
- **Inventory semantics:** *reserved* and *in-transit* quantities are computed dynamically from open sales orders and purchase orders (SQL views with lateral joins) instead of stored counters — physical stock only changes on invoicing or POS sale, which eliminated a whole class of negative-stock bugs.
- **Multi-org:** data is scoped by `org_id` with a dedicated `erp` Postgres schema; a super-admin can switch organizations from the UI.
- **Performance conventions:** explicit column selects, heavy libraries (jsPDF, ExcelJS) loaded via dynamic import, role read from the JWT in middleware without a DB round-trip.
- **Responsive:** usable as a PWA on phones — list views collapse to cards, filters collapse behind a drawer.

## Running locally

Requires a Supabase project with the `erp` schema exposed in the API settings (plus the schema grants in [`CLAUDE.md`](CLAUDE.md)), and Finkok credentials for stamping.

```bash
npm install
npm run dev
```

`.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
FINKOK_USERNAME=...
FINKOK_PASSWORD=...
FINKOK_AMBIENTE=dev
```

## Status

In production for a single client. Honest list of what's not done yet: automated tests, hardened end-to-end RLS for full multi-tenancy, and server-side aggregation for the heaviest reports. Detailed technical docs (schema, RPCs, conventions) are in [`CLAUDE.md`](CLAUDE.md).

---

Built by [Julio Alexis González Villa](https://github.com/Sixale730) — AI Engineer · Machine Learning Engineer.