# DevForge — AI-Assisted Development Workflow Platform

> Build AI-assisted projects without losing context, prompts, or your mind.

## What is DevForge?

DevForge is a fully cloud-based, browser-accessible platform that systematizes and automates every step of the AI-assisted software development workflow — from project ideation through global context document generation, file-by-file code generation, error resolution, and new feature addition. Every prompt is stored, every file is tracked, and every piece of context is preserved so that nothing is ever lost and every project is built with perfect consistency from the first file to the last.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3.4 |
| Components | shadcn/ui (Radix UI) |
| Animations | Framer Motion |
| Code Editor | Monaco Editor |
| State | Zustand + TanStack Query v5 |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | NextAuth.js v5 |
| Real-Time | Supabase Realtime |
| AI Integration | Groq SDK |
| Export | JSZip + FileSaver.js |
| Search | Fuse.js |
| Drag & Drop | @dnd-kit |
| PWA | next-pwa |
| Deployment | Vercel |

---

## Prerequisites

- **Node.js** 20.x or later
- **npm** 10.x or later
- A **Supabase** project (free tier works)
- A **Vercel** account (for deployment) or any Node.js hosting

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/devforge.git
cd devforge
```

### 2. Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically via the `postinstall` script.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in all required values. See `.env.example` for descriptions of each variable.

**Required variables:**

```
DATABASE_URL           # Supabase PostgreSQL URL (with ?pgbouncer=true)
DIRECT_URL             # Supabase direct connection URL (for migrations)
NEXTAUTH_URL           # http://localhost:3000 in development
NEXTAUTH_SECRET        # Generate with: openssl rand -base64 32
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL    # http://localhost:3000 in development
```

**Optional variables:**

```
GOOGLE_CLIENT_ID       # For Google OAuth login
GOOGLE_CLIENT_SECRET
GROQ_API_KEY           # Can also be configured per-user in Settings
```

### 4. Run database migrations

```bash
npx prisma migrate dev
```

This creates all tables in your Supabase database and generates the Prisma client.

### 5. Seed the database

```bash
npx prisma db seed
```

This creates:
- A default admin user: `admin@devforge.local` / `devforge123`
- All 7 default prompt templates

### 6. Install shadcn/ui components

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input card dialog dropdown-menu select textarea toast tabs badge table checkbox label radio-group switch progress separator tooltip popover scroll-area collapsible skeleton alert sheet command avatar
```

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma migrate dev` | Run database migrations (development) |
| `npx prisma migrate deploy` | Run database migrations (production) |
| `npx prisma db seed` | Seed default data |
| `npx prisma studio` | Open Prisma database browser |

---

## Features

- **Global Context Document** — Single source of truth for every project, auto-versioned on every change
- **Sequential File Generation** — Checklist of every file with stored per-file prompts and status tracking
- **Monaco Browser Editor** — VSCode-identical code editor, runs entirely in the browser
- **JSON Registry Append** — Keeps Section 11 of the GCD current after every file generation
- **Error Resolution Workflow** — Two-step prompt generation (file identification + surgical line replacement)
- **New Feature Addition** — JSON delta workflow that extends the project without overwriting anything
- **Community Prompt Library** — Browse, copy, and submit prompts for all AI tools
- **Personal Prompt Collections** — Organize and share prompt collections
- **Terminal Script Generator** — Instant CMD/Bash scaffolding scripts for local project setup
- **Full Mobile Support** — Every feature works on smartphone, with bottom navigation and touch-optimised UI
- **PWA** — Installable on mobile with offline document reading

---

## Deployment (Vercel)

### 1. Push to GitHub

```bash
git add .
git commit -m "initial commit"
git push origin main
```

### 2. Create a Vercel project

Connect your GitHub repository at [vercel.com](https://vercel.com). Vercel detects Next.js automatically.

### 3. Set environment variables

In the Vercel dashboard under **Settings → Environment Variables**, add all variables from `.env.example`. Key values to update for production:

- `NEXTAUTH_URL` → your production domain (e.g. `https://devforge.yourdomain.com`)
- `NEXT_PUBLIC_APP_URL` → same as above
- `DATABASE_URL` → Supabase pgbouncer connection string
- `DIRECT_URL` → Supabase direct connection string

### 4. Run production migrations

After the first deploy, run migrations against your production database:

```bash
npx prisma migrate deploy
npx prisma db seed
```

### 5. Configure Google OAuth (optional)

In [Google Cloud Console](https://console.cloud.google.com):
1. Add your production domain to **Authorized JavaScript origins**
2. Add `https://yourdomain.com/api/auth/callback/google` to **Authorized redirect URIs**

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (auth)/             # Login, register, password reset pages
│   ├── (app)/              # Authenticated app pages
│   └── api/                # API route handlers
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── shared/             # Reusable shared components
│   ├── layout/             # App shell, sidebar, navigation
│   ├── dashboard/          # Dashboard-specific components
│   ├── workspace/          # Project workspace components
│   ├── library/            # Community prompt library components
│   ├── collections/        # Personal collections components
│   ├── feed/               # Community project feed components
│   └── settings/           # Settings page components
├── hooks/                  # Custom React hooks (TanStack Query wrappers)
├── lib/                    # Core library utilities (prisma, auth, supabase, groq)
├── services/               # Business logic services
├── store/                  # Zustand global state stores
├── types/                  # TypeScript type definitions
└── validations/            # Zod validation schemas
prisma/
├── schema.prisma           # Database schema
└── seed.ts                 # Database seed script
public/                     # Static assets and PWA files
```

---

## License

MIT