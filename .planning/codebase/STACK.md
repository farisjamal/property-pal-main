# Technology Stack

**Analysis Date:** 2026-02-18

## Languages

**Primary:**
- TypeScript 5.8.3 - All application source code in `src/`
- SQL - Database migrations in `supabase/migrations/`

**Secondary:**
- JavaScript - Config files (`vite.config.ts`, `postcss.config.js`, `eslint.config.js` are TS/JS)
- HTML - Entry point `index.html`

## Runtime

**Environment:**
- Browser (client-side SPA) - no Node.js server runtime

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 18.3.1 - UI component framework
- React Router DOM 6.30.1 - Client-side routing with nested routes and `ProtectedRoute` wrappers

**State Management:**
- @tanstack/react-query 5.83.0 - Server state management, caching, and data fetching

**Form Handling:**
- React Hook Form 7.61.1 - Form state management
- Zod 3.25.76 - Schema validation
- @hookform/resolvers 3.10.0 - Zod integration for React Hook Form

**Build/Dev:**
- Vite 5.4.19 - Build tool and dev server (port 8080)
- @vitejs/plugin-react-swc 3.11.0 - SWC-powered React fast refresh

## Key Dependencies

**UI Framework:**
- shadcn/ui - Component system configured via `components.json`, style: "default"
- All 23+ Radix UI primitives (accordion, alert-dialog, avatar, dialog, dropdown-menu, etc.) - Headless UI primitives for shadcn components
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- tailwindcss-animate 1.0.7 - Animation utilities plugin
- tailwind-merge 2.6.0 - Conditional class merging
- class-variance-authority 0.7.1 - Component variant management
- clsx 2.1.1 - Class name utility
- lucide-react 0.462.0 - Icon library

**UI Components:**
- embla-carousel-react 8.6.0 - Carousel component
- react-resizable-panels 2.1.9 - Resizable panel layouts
- react-day-picker 8.10.1 - Date picker
- input-otp 1.4.2 - OTP input component
- vaul 0.9.9 - Drawer component
- cmdk 1.1.1 - Command palette
- sonner 1.7.4 - Toast notifications
- next-themes 0.3.0 - Theme (dark/light mode) management
- recharts 2.15.4 - Chart library for admin dashboards

**Data/Date:**
- date-fns 3.6.0 - Date manipulation utilities

**Security (Critical):**
- crypto-js 4.2.0 - AES-256 encryption for IC numbers and contact numbers (see `src/utils/security.ts`)
- bcryptjs 3.0.3 - bcrypt hashing for security PINs (salt rounds: 10)

**Backend/Database:**
- @supabase/supabase-js 2.89.0 - Supabase client SDK for auth, database, and real-time

## Configuration

**TypeScript - `tsconfig.app.json`:**
- Target: ES2020
- Module: ESNext / bundler resolution
- JSX: react-jsx
- Strict mode: disabled (`strict: false`)
- `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false`

**TypeScript - `tsconfig.json`:**
- Composite config referencing `tsconfig.app.json` and `tsconfig.node.json`
- Path alias: `@/*` maps to `./src/*`

**ESLint - `eslint.config.js`:**
- TypeScript ESLint 8.38.0 with recommended rules
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- `@typescript-eslint/no-unused-vars` explicitly disabled

**PostCSS - `postcss.config.js`:**
- Plugins: tailwindcss, autoprefixer

**Tailwind - `tailwind.config.ts`:**
- Dark mode: class-based
- Custom brand colors: `property-warm`, `property-earth` (CSS variable backed)
- Custom animations: `fade-up`, `fade-in`, `float`
- Custom fonts: Roboto (sans), Roboto Mono (mono), Libre Caslon Text (serif)

**Vite - `vite.config.ts`:**
- Dev server: `host: "::"`, `port: 8080`
- Plugin: react-swc, lovable-tagger (dev only)
- Alias: `@` → `./src`

**shadcn/ui - `components.json`:**
- Style: default
- Base color: slate
- CSS variables: enabled
- TSX: true, RSC: false

## Environment Variables

**Required in `.env`:**
- `VITE_SUPABASE_URL` - Supabase project URL (accessed in `src/integrations/supabase/client.ts`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key (accessed in `src/integrations/supabase/client.ts`)
- `VITE_ENCRYPTION_KEY` - AES encryption secret (accessed in `src/utils/security.ts`; app throws fatal error if missing)

## Platform Requirements

**Development:**
- Node.js with npm
- `.env` file with all three required variables
- `npm run dev` starts at `http://localhost:8080`

**Production:**
- Static SPA build via `npm run build`
- Deployable to any static host (Netlify, Vercel, etc.)
- Supabase project required for backend services

---

*Stack analysis: 2026-02-18*
