# 🚀 Enhancement Prompt — business_plan_tunisia
**Repo:** https://github.com/icloudsolutions/business_plan_tunisia  
**Stack:** Next.js (TypeScript) · FastAPI · Celery · PostgreSQL · Redis · Docker Compose  
**Domain:** Collaborative 7-year business plan platform, compliant with Tunisia's Liasse Unique (TIA)

---

## 📋 Current State Analysis

### Architecture (strong foundation)
- **6-service Docker Compose stack**: nginx · Next.js frontend · FastAPI API · Celery worker · Redis · Postgres
- **4-state workflow**: `DRAFT → UNDER_REVIEW → ADJUSTMENT → VALIDATED`
- **Role-based access**: Client / Expert / Admin
- **Financial engine** (`bp_calc`): P&L, BFR, VAN, TRI, DRCI over 7 years
- **Export engine**: PDF + Excel (Celery async jobs)
- **Finance cockpit** at `/finance`: Recharts, client-side only (mock data)
- **Cost dashboard** UI at `/finance` described as "demo UI with fictional data"

### Identified Gaps & Weaknesses
1. Finance cockpit uses **fictional/static data** — not connected to real plan data
2. No **AI-assisted data entry** or field suggestions
3. No **real-time collaboration** (no WebSocket / SSE push)
4. Admin panel (`/admin`) has limited described functionality
5. **No onboarding flow** — blank slate for new clients
6. **No notification system** (email/in-app) for workflow transitions
7. No **audit trail / comment thread** per plan section
8. **Mobile responsiveness** not mentioned
9. No **dark mode** support
10. No **progress indicator** showing how complete a plan is
11. No **scenario comparison** (optimistic / base / pessimistic)
12. Financial charts are separate from the plan editing flow
13. No **localization toggle** (FR ↔ AR) for Tunisian bilingual users
14. No **guided wizard** for first-time business plan creation

---

## 🎨 UI Enhancement Prompts

### PROMPT 1 — Redesign the Main Dashboard (Client View)

```
You are a senior product designer. Redesign the Next.js client dashboard 
for a Tunisian business plan platform (Liasse Unique compliant). 

Requirements:
- Replace the blank landing with a structured "Plan Overview" card showing:
  • Plan name, sector, creation date
  • Current workflow state (DRAFT / UNDER_REVIEW / ADJUSTMENT / VALIDATED) 
    rendered as a horizontal stepper with animated progress
  • Completion percentage ring (how many required fields are filled)
  • Quick-action buttons: "Continue Editing", "Request Review", "Download PDF"
- Add a persistent top navigation with:
  • Logo + plan name breadcrumb
  • Role badge (CLIENT / EXPERT / ADMIN)
  • Notification bell with unread count
  • Language switcher (FR / AR with RTL support)
- Use a refined professional color palette: deep navy (#0F2744) primary, 
  gold (#C9A84C) accent, clean white surfaces — evoking Tunisian banking 
  and institutional trust
- Typography: Playfair Display for headings, IBM Plex Sans for body text
- Add subtle background texture: fine geometric mesh inspired by 
  traditional Tunisian tilework (CSS SVG pattern)
- All components must be fully responsive (mobile-first)

Deliver: React/TypeScript components using Tailwind CSS
```

---

### PROMPT 2 — Redesign the Liasse Form Entry Experience

```
You are a UX engineer specializing in complex multi-step financial forms.
Redesign the Liasse Unique data entry screens in Next.js.

Current problem: The form likely presents all fields at once, overwhelming 
users unfamiliar with fiscal/financial terminology.

Redesign as a guided wizard:
- Split the Liasse Unique into logical sections (e.g., "Informations 
  Générales", "Investissements", "Financement", "Exploitation", 
  "Ressources Humaines", "Indicateurs Financiers")
- Each section is a separate wizard step with:
  • Section title + brief explainer text in simple French
  • Context-sensitive tooltip on every field (what it means, where to 
    find the value, example value)
  • Field-level validation with inline error messages
  • Auto-save every 30 seconds with a subtle "Saved" toast
  • Back / Next navigation + "Save & Exit" at any point
- Add a sticky sidebar showing:
  • Section mini-map (all steps, current step highlighted)
  • Live running totals (e.g., Total Investissement, Capital Propre)
  • "Consistency alerts" when numbers conflict (e.g., financing < investment)
- Animate section transitions with a smooth horizontal slide
- On the final step show a "Pre-flight check" summarizing warnings 
  before the user submits for expert review

Deliver: Next.js page + components, TypeScript, Tailwind CSS, 
using react-hook-form + zod validation
```

---

### PROMPT 3 — Real-Time Collaboration Panel (Expert + Client)

```
Design and implement a real-time collaboration sidebar for the 
business plan platform. This appears when the plan is in 
UNDER_REVIEW or ADJUSTMENT state.

Features:
- Threaded comment system anchored to specific form fields/sections:
  • Expert can leave a comment on any field (e.g., "Veuillez justifier 
    ce montant d'investissement")
  • Client sees the comment highlighted in orange on that field
  • Both can reply in thread
  • Comments can be marked "Resolved" (collapses the thread)
- Activity feed showing the last N state changes and comments
- Expert annotation toolbar: approve ✓ / flag ⚠ / reject ✗ per section
- "Request Adjustment" button that transitions state with an optional 
  global message
- WebSocket connection via FastAPI (add `/ws/plans/{id}` endpoint) 
  or SSE polling fallback every 10 seconds
- Presence indicators: show a colored dot next to the plan title when 
  another user is currently viewing it

Backend additions needed:
- `comments` table: id, plan_id, field_key, user_id, content, 
  parent_id, resolved, created_at
- POST/GET/PATCH endpoints for comments
- WebSocket broadcast on comment create / state change

Deliver: React sidebar component + FastAPI WebSocket endpoint + 
SQLAlchemy model
```

---

### PROMPT 4 — Financial Cockpit v2 (Live Data, Not Mock)

```
You are a fintech dashboard engineer. Upgrade the /finance cockpit from 
demo/mock data to a fully live dashboard connected to the real 
business plan data via the FastAPI API.

Current state: The /finance page uses hard-coded Recharts data.

Upgrade:
1. Connect to GET /api/plans/{id}/projections (create this endpoint) 
   which returns the 7-year P&L, BFR, VAN, TRI, DRCI computed by 
   the Celery bp_calc worker
2. Dashboard tabs:
   • "Résultats" — 7-year revenue, expenses, net profit (grouped bar chart)
   • "Trésorerie" — monthly/annual cash flow waterfall chart
   • "Investissements" — donut chart of investment breakdown by category
   • "Indicateurs Clés" — KPI cards: VAN, TRI, DRCI, Point Mort, 
     Marge Brute, EBE, with trend arrows vs. prior projection run
3. Scenario comparison toggle: Pessimiste / Base / Optimiste
   • User sets scenario multipliers (e.g., revenue -15% / base / +15%)
   • All charts re-render with scenario overlay lines
4. "Simulation" panel: slider inputs for key assumptions 
   (Chiffre d'Affaires Year 1, Taux de Croissance, Taux Emprunt) 
   that trigger a new Celery calc job and refresh charts on completion
5. Export buttons: "Télécharger Excel" and "Télécharger PDF" that 
   call the existing export endpoints with a progress indicator

Use Recharts (already in stack). Add loading skeletons while Celery 
job runs. Poll GET /api/plans/{id}/exports/{jobId} every 3s.

Deliver: Next.js /finance/[id] page, TypeScript, FastAPI projections 
endpoint, Celery task update
```

---

### PROMPT 5 — Admin Panel Enhancement

```
Redesign and expand the /admin panel for the platform administrator.

Current state: Basic user management (list/create users, create experts).

Add the following sections:

1. USER MANAGEMENT (existing, improve UI)
   - Data table with columns: Name, Email, Role, Plans Count, 
     Last Active, Status (Active/Suspended)
   - Inline role change dropdown
   - Suspend / Reactivate toggle
   - Bulk actions: export CSV, send reset-password email

2. PLAN OVERSIGHT
   - Table of all plans across all clients
   - Columns: Plan Name, Client, Assigned Expert, State, 
     Last Updated, Completion %, Export Status
   - Filter by state, expert, date range
   - Admin can force-transition any plan state
   - Admin can reassign expert

3. ANALYTICS DASHBOARD
   - Plans created per month (line chart)
   - Distribution by state (donut)
   - Average time per state (bar chart)
   - Expert workload (plans per expert)

4. SYSTEM HEALTH
   - Show API health (from /api/health)
   - Celery queue depth (from Redis)
   - Postgres storage usage
   - Recent error logs (last 20 lines from API container, 
     via a new GET /api/admin/logs endpoint)

5. NOTIFICATION CENTER
   - Admin can send in-app notification or email to any user 
     or all users with a given role
   - Template system for common messages (plan validated, 
     action required, etc.)

Deliver: Next.js /admin pages, TypeScript, Tailwind CSS, 
using shadcn/ui data table + recharts
```

---

## ⚙️ Feature Enhancement Prompts

### PROMPT 6 — AI-Assisted Field Suggestions

```
Integrate Claude AI into the business plan form to help clients 
fill in difficult financial fields.

Implementation:
1. Add a small "✨ Aide IA" button next to complex fields 
   (e.g., "Chiffre d'Affaires Prévisionnel Année 1", 
   "Besoin en Fonds de Roulement")
2. Clicking opens a modal with a chat interface:
   - Pre-filled prompt context: the user's business sector, 
     type (PME/GE), location, and already-filled fields
   - User can ask: "Comment estimer mon CA pour une boulangerie 
     à Tunis avec 3 employés ?"
   - Claude responds with a concrete suggested value + explanation 
     + benchmark data from similar Tunisian SMEs
   - "Appliquer cette valeur" button fills the field automatically
3. AI suggestions are logged (plan_id, field, suggestion, accepted) 
   for quality analysis
4. Add a "Générer un résumé exécutif" button on the final step 
   that calls Claude to write a 200-word executive summary in French 
   based on all filled fields

Backend: POST /api/plans/{id}/ai-assist endpoint that calls 
Claude claude-sonnet-4-20250514 with a structured system prompt 
including the Tunisian business context and Liasse Unique schema

Deliver: React modal component + FastAPI AI endpoint + Claude integration
```

---

### PROMPT 7 — Email Notification System

```
Implement a transactional email notification system for all 
workflow state transitions.

Trigger points and recipients:
- DRAFT → UNDER_REVIEW: Email expert "Un nouveau plan vous a été 
  soumis pour validation" + link
- UNDER_REVIEW → ADJUSTMENT: Email client "Des corrections sont 
  requises par votre expert" + list of flagged sections
- ADJUSTMENT → UNDER_REVIEW: Email expert "Le client a soumis 
  les corrections" 
- UNDER_REVIEW → VALIDATED: Email client + admin "Votre plan a été 
  validé — téléchargez votre liasse définitive"
- New comment on a field: Email the other party with a preview

Implementation:
- Add EMAIL_PROVIDER config to .env (SMTP or Resend API)
- Create email templates in HTML (bilingual FR/AR, responsive)
- Add email_notifications table: id, plan_id, user_id, type, 
  sent_at, opened_at
- Send via background Celery task (not blocking the API response)
- Admin dashboard shows delivery stats

Deliver: Celery email task + Jinja2 HTML email templates + 
FastAPI trigger integration + env config
```

---

### PROMPT 8 — Progress & Completion Tracking

```
Add a smart completion tracking system to the plan editing experience.

Requirements:
1. Define completion rules per Liasse section:
   - "Required" fields (block submission if empty)
   - "Recommended" fields (warn but allow submission)
   - "Optional" fields (ignored in completion %)
2. Completion % is computed server-side (GET /api/plans/{id}/completion):
   - Returns per-section score and overall score
   - Flags which required fields are missing
3. In the frontend:
   - Global progress bar in the header (e.g., "Plan complété à 72%")
   - Per-section completion chip in the wizard sidebar 
     (green checkmark / orange warning / red circle)
   - On attempting to submit for review, show a blocking modal 
     if required fields are missing, listing them with links 
     to jump directly to those fields
4. Gamification (subtle):
   - "Étape franchie!" toast when a section reaches 100%
   - Milestone badge when overall plan reaches 50% / 100%
5. Expert sees the same completion view + a "Completeness Report" 
   they can download as PDF with all missing fields highlighted

Deliver: FastAPI completion endpoint + Next.js progress components 
+ section validation rules in bp_schema
```

---

### PROMPT 9 — Scenario Planning Module

```
Add a "Scénarios" module that allows clients and experts to model 
optimistic, base, and pessimistic versions of the business plan.

Features:
1. Scenario Manager (accessible from the plan detail page):
   - Three default scenarios: "Pessimiste", "Base", "Optimiste"
   - Each scenario stores multipliers for key assumptions:
     • Revenue growth rate per year (Y1–Y7)
     • Personnel cost growth
     • Raw material cost ratio
     • Loan interest rate
   - User can create custom named scenarios
2. Each scenario triggers a new Celery bp_calc job producing 
   full 7-year projections
3. Comparison view:
   - Side-by-side KPI table: VAN / TRI / DRCI / Point Mort 
     across all 3 scenarios
   - Overlay line chart: Net Profit Y1–Y7 with one line per scenario 
     (colored: red=pessimiste, gray=base, green=optimiste)
   - "Recommend" button for expert to mark the scenario 
     used for the official Liasse submission
4. The validated scenario's projections are what get exported 
   to the Excel and PDF outputs

Database:
- scenarios table: id, plan_id, name, multipliers (JSONB), 
  calc_job_id, is_official
- Link projections to scenario_id

Deliver: FastAPI scenario CRUD endpoints + Celery task update 
+ React scenario manager + comparison chart component
```

---

### PROMPT 10 — Audit Trail & Version History

```
Implement a complete audit trail for every business plan.

Requirements:
1. Log every change to any plan field:
   - Table: plan_audit_log (id, plan_id, user_id, field_path, 
     old_value, new_value, changed_at)
   - Capture on every PATCH /api/plans/{id} call using a 
     FastAPI middleware or event hook
2. Version snapshots:
   - Automatically snapshot the entire plan JSON at each 
     state transition (DRAFT→UNDER_REVIEW, etc.)
   - Manual snapshot: "Créer un point de sauvegarde" button
   - Store in plan_versions table: id, plan_id, state, 
     snapshot (JSONB), created_by, created_at
3. History UI (accessible via clock icon in plan header):
   - Timeline of all snapshots with actor, date, state
   - "Comparer avec la version actuelle" button opens a 
     JSON diff view highlighting changed fields
   - "Restaurer cette version" (admin/expert only) with 
     confirmation dialog
4. Expert view: "Historique des modifications" showing 
   a field-level log sorted by recency, so they can see 
   exactly what the client changed between submissions

Deliver: FastAPI audit middleware + plan_versions model + 
Next.js history timeline component + diff view
```

---

## 🛠️ DevOps & Quality Prompts

### PROMPT 11 — Testing Coverage

```
Add comprehensive test coverage to the business_plan_tunisia project.

1. Backend (pytest — already partially set up):
   - Unit tests for ALL bp_calc functions: P&L, BFR, VAN, TRI, DRCI
     with edge cases (zero revenue, negative BFR, high debt ratio)
   - FastAPI integration tests using TestClient:
     • Auth endpoints (login, token refresh, admin user creation)
     • Plan CRUD (create, read, update, state transition guards)
     • Export job creation and polling
   - Celery task tests using celery eager mode
   - Target: 80% coverage on api/ and packages/

2. Frontend (Vitest + React Testing Library):
   - Component tests for form validation (required field blocking)
   - Wizard navigation (next/back/save)
   - Role-based UI gating (expert actions hidden for client role)
   - Mock API responses using msw

3. E2E (Playwright):
   - Full flow: login as client → create plan → fill section → 
     submit for review → login as expert → add comment → 
     validate → download export
   - Run in CI via GitHub Actions on every push to main

4. Add GitHub Actions workflow:
   - Lint (ruff for Python, eslint for TS)
   - Type-check (mypy, tsc)
   - Unit tests
   - Docker build smoke test

Deliver: pytest test files + Vitest setup + Playwright e2e + 
.github/workflows/ci.yml
```

---

### PROMPT 12 — Internationalization (FR ↔ AR)

```
Add full bilingual support (French / Arabic with RTL) to the 
Next.js frontend.

Requirements:
1. Use next-intl library for i18n routing:
   - Default locale: fr
   - Second locale: ar (RTL)
   - URL structure: /fr/... and /ar/...
2. Translation files:
   - messages/fr.json — all French UI strings
   - messages/ar.json — Arabic translations of all UI strings
   - Include all Liasse Unique field labels, section titles, 
     button text, error messages, tooltips
3. RTL support:
   - Use `dir="rtl"` on <html> for Arabic locale
   - Replace all directional Tailwind classes with logical 
     equivalents (ms-/me- instead of ml-/mr-)
   - Test all form layouts, sidebars, and navigation in RTL
4. Language switcher in the top nav:
   - Flag icon + language name
   - Persists preference in localStorage + cookie for SSR
5. Date and number formatting:
   - Dates in Arabic locale use Arabic numerals + Hijri option
   - Numbers use French decimal format (1 234,56 DT) in FR 
     and Arabic format in AR
6. Email templates: also ship Arabic version of all 
   notification emails

Deliver: next-intl setup + messages/ translation files + 
RTL CSS audit + language switcher component
```

---

## 📊 Priority Matrix

| # | Prompt | Impact | Effort | Priority |
|---|--------|--------|--------|----------|
| 1 | Dashboard Redesign | High | Medium | 🔴 P1 |
| 2 | Guided Form Wizard | High | High | 🔴 P1 |
| 4 | Live Finance Cockpit | High | Medium | 🔴 P1 |
| 8 | Completion Tracking | High | Low | 🔴 P1 |
| 3 | Real-Time Collaboration | High | High | 🟡 P2 |
| 6 | AI Field Assistance | High | Medium | 🟡 P2 |
| 7 | Email Notifications | Medium | Low | 🟡 P2 |
| 5 | Admin Panel | Medium | Medium | 🟡 P2 |
| 9 | Scenario Planning | Medium | High | 🟠 P3 |
| 10 | Audit Trail | Medium | Medium | 🟠 P3 |
| 11 | Test Coverage | High | High | 🟠 P3 |
| 12 | Internationalization | Medium | High | 🟠 P3 |

---

## 🔑 Quick Wins (implement in < 1 day each)

1. **Auto-save indicator** — Show "Sauvegardé il y a 30s" in form header
2. **Loading skeletons** — Replace blank states while API fetches
3. **Toast notifications** — Feedback for all user actions (save, submit, error)
4. **Empty state illustrations** — When no plan exists yet, show an 
   inviting "Créez votre premier business plan" CTA with an illustration
5. **Print/PDF preview** — Add a `@media print` CSS stylesheet so 
   the form renders cleanly before export
6. **Keyboard shortcuts** — `Ctrl+S` to save, `Alt+→` to next section
7. **Session expiry warning** — 5 minutes before JWT expires, 
   show a modal with "Prolonger la session" button

---

*Generated by analysis of https://github.com/icloudsolutions/business_plan_tunisia*  
*Stack: Next.js · FastAPI · Celery · PostgreSQL · Redis · Docker Compose*
