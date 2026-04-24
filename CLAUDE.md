# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A React app that digitizes handwritten tailoring shop repair tickets using Gemini AI vision. Users upload ticket photos, Gemini extracts structured data (customer info, line items, amounts), and a human-in-the-loop review UI lets operators correct results before exporting to CSV/TSV or syncing to Google Sheets.

Originally scaffolded from Google AI Studio.

## Commands

- `npm run dev` — Start dev server on port 3000
- `npm run build` — Production build via Vite
- `npm run lint` — Type-check only (`tsc --noEmit`), no ESLint

## Architecture

Single-page React app (no router). Two tabs: **Scan** (upload + review) and **Dashboard** (analytics from Google Sheets).

### Key data flow

1. **Upload** → images converted to base64, queued with max 3 concurrent extractions
2. **Extraction** → `src/services/geminiService.ts` sends image + system prompt to Gemini (`gemini-3-flash-preview`) with a structured JSON schema, returns `ExtractionResult`
3. **Review** → editable form in `TicketCard` (inline in `App.tsx`) with confidence indicators; balance auto-recalculates from total/paid
4. **Export** → CSV/TSV download, clipboard copy, or POST to Google Apps Script URL for Sheets sync

### File layout

- `src/App.tsx` — All app state, processing queue, upload handling, `TicketCard` and `FormField` components (large monolith ~1000 lines)
- `src/types.ts` — `Ticket`, `ExtractionResult`, `ExtractionItem`, confidence types
- `src/services/geminiService.ts` — Gemini API call with detailed system instruction for handwriting extraction rules
- `src/components/Dashboard.tsx` — Fetches CSV from a hardcoded Google Sheet, parses with PapaParse, renders charts via Recharts
- `src/lib/utils.ts` — `cn()`, `formatCurrency()`, `generateCSV()`, `generateTSV()`, `fileToBase64()`

### Important patterns

- **Gemini API key** is injected at build time via Vite's `define` as `process.env.GEMINI_API_KEY`. Set it in `.env.local`.
- **State persistence** uses localStorage (`ticket_extractor_state` key) — tickets including base64 image data are stored there.
- **Print feature** in `TicketCard` optionally translates item descriptions to Spanish via a separate Gemini call before opening a print window.
- **Path alias**: `@/` maps to project root (both in tsconfig and Vite config).
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` plugin. Animations use `motion` (Framer Motion).
