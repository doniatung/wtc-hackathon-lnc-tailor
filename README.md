# Ticket Extractor

Digitize handwritten tailoring shop repair tickets using Gemini AI vision. Upload photos of carbon-copy repair tickets, review AI-extracted data with confidence indicators, then export to CSV/TSV or sync directly to Google Sheets.

## Features

- **Batch upload** with drag-and-drop or file picker (JPG, PNG, HEIC)
- **Parallel processing** — up to 3 concurrent Gemini extractions
- **Human-in-the-loop review** — editable fields with confidence badges (high/medium/low)
- **Auto-calculated balance** from ticket total and amount paid
- **Nested CSV/TSV export** — multi-item tickets flatten with one row per line item
- **Google Sheets sync** via Apps Script web app URL
- **Print tickets** with optional Spanish translation for tailors
- **Dashboard tab** — live analytics pulled from a connected Google Sheet (Recharts)
- **Session persistence** — all ticket data saved to localStorage

## Getting Started

### Prerequisites

- Node.js (v18+)

### Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env.local` file in the project root and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
   You can get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

3. Start the dev server:
   ```
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key. Injected at build time via Vite's `define` config — it is embedded in the client bundle, so do not use a key with billing in a publicly deployed build. |

> **Note:** The API key is read from `.env.local` (gitignored) and baked into the bundle at build time as `process.env.GEMINI_API_KEY`. It is **not** a server-side secret in this architecture — it ships to the browser.

## Usage

1. **Upload** — Drop ticket photos onto the upload zone or click "Browse Files"
2. **Review** — Extracted tickets appear in the review panel. Edit any field; confidence dots indicate extraction certainty. Balance recalculates automatically.
3. **Export** — Use the bottom action bar to:
   - **Download Nested CSV** — one row per line item, ticket-level fields on the first row only
   - **Copy TSV** — paste directly into a spreadsheet
   - **Sync to Sheets** — POST data to a Google Apps Script web app URL (configure in the sidebar)

## Architecture

```
src/
  App.tsx                   # Main app state, upload handling, processing queue,
                            # TicketCard review UI, export actions (~1000 lines)
  types.ts                  # Ticket, ExtractionResult, ExtractionItem, confidence types
  main.tsx                  # React entry point
  index.css                 # Tailwind CSS v4 import
  services/
    geminiService.ts        # Gemini API call with structured JSON schema and
                            # detailed system prompt for handwriting extraction
  components/
    Dashboard.tsx           # Analytics tab — fetches CSV from Google Sheets,
                            # parses with PapaParse, renders Recharts charts
  lib/
    utils.ts                # cn(), formatCurrency(), generateCSV(), generateTSV(),
                            # fileToBase64()
```

### Data Flow

1. **Upload** — Images are converted to base64 and added to a processing queue
2. **Extract** — `geminiService.ts` sends each image to Gemini (`gemini-3-flash-preview`) with a system instruction tuned for carbon-copy tailor tickets (strikethroughs, continuation lines, US date formats)
3. **Review** — Extracted data is rendered in an editable form with per-field confidence indicators
4. **Export** — Approved tickets are flattened to nested CSV/TSV or POSTed to a Google Apps Script endpoint

### Tech Stack

- **React 19** with Vite 6
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **Framer Motion** (`motion`) for animations
- **Recharts** for dashboard charts
- **PapaParse** for CSV parsing in the dashboard
- **@google/genai** SDK for Gemini API calls

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run lint` | Type-check (`tsc --noEmit`) |
| `npm run clean` | Remove `dist/` |
