---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.css"
  - "**/*.scss"
  - "**/*.html"
  - "**/components/**"
  - "**/pages/**"
  - "**/layouts/**"
---

# Frontend

## Design Tokens

Before writing frontend code, check `tailwind.config.ts` for the project''s token definitions. Never hardcode raw hex colors, spacing values, or font sizes in components — use Tailwind utility classes or CSS variables from the theme.

## Design Principles

This project uses **Glassmorphism / dark-mode dashboard** aesthetic for admin/owner panels and a clean **Minimalism** style for the landing page. Keep these consistent — don''t introduce new design languages.

## Component Framework

This project''s stack is fixed. Do not introduce competing libraries.

| Category | **In use** |
|---|---|
| CSS | **Tailwind CSS** |
| Primitives | **shadcn/ui + Radix UI** |
| Animation | CSS transitions, `tailwindcss-animate` |
| Charts | **Recharts** |
| Icons | **Lucide React** |
| Theme | **next-themes** (dark/light) |

## Layout

- CSS Grid for 2D, Flexbox for 1D. Use `gap`, not margin hacks.
- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`.
- Mobile-first. Touch targets: minimum 44x44px.
- Layouts live in `src/components/layout/` — AdminLayout, OwnerLayout, TenantLayout.

## Accessibility (non-negotiable)

- All interactive elements keyboard-accessible.
- Images: meaningful `alt` text. Decorative: `alt=""`.
- Form inputs: associated `<label>` or `aria-label`.
- Contrast: 4.5:1 normal text, 3:1 large text.
- Visible focus indicators. Never `outline: none` without replacement.
- Color never the sole indicator.
- `aria-live` for dynamic content. Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## Performance

- Images: `loading="lazy"` below fold, explicit `width`/`height`.
- Fonts: `font-display: swap`.
- Animations: `transform` and `opacity` only.
- Large lists: virtualize at 100+ items.
- Bundle size: never import a whole library for one function.
