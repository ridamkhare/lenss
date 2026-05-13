# lens

A perception instrument for the shape of an AI answer.

Paste an AI-generated passage. The instrument reveals five facets of how
that answer was shaped — dominant framing, hidden assumptions, suppressed
alternatives, semantic gravity, and one alternate framing that lets the
meaning shift without breaking.

This is a prototype. It is intentionally small.

## Run

```
npm install
npm run dev
```

Open http://localhost:3000.

The app works offline with a hand-crafted mock reading. To get real
analysis from Claude, add an `.env.local` with:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The mock returns the same response for every input. The Claude path
returns a fresh reading per passage. The mock exists so the UI can be
explored without an API key.

## Shape

```
lens/
├── app/
│   ├── layout.tsx        # fonts (Newsreader serif, Inter sans), shell
│   ├── page.tsx          # the one route. Owns state and view selection.
│   ├── globals.css       # paper bg, ink colors, base typography
│   └── api/reveal/
│       └── route.ts      # POST. Validates and calls analyze().
├── components/
│   ├── ui/               # shadcn-style primitives
│   │   ├── button.tsx
│   │   └── textarea.tsx
│   └── lens/             # the product's own components
│       ├── InputView.tsx
│       ├── ResultView.tsx
│       ├── DimensionBlock.tsx     # used 5x, identical structure
│       └── MessageView.tsx        # refusal + error
└── lib/
    ├── analyze.ts        # Claude or mock — single entry point
    ├── prompt.ts         # system prompt + calibration example
    ├── types.ts          # RevealResult + DeclinedResult
    └── utils.ts          # cn()
```

## Design system in one paragraph

Paper-warm background (`#FAF8F4`), near-black ink, one chromatic accent
(a desaturated slate-blue), serif body (Newsreader) and sans labels (Inter).
Single column, max-width 640px, never wider. Spacing is generous; whitespace
replaces lines wherever it can. Motion is slow and eased — sections fade
and translate 8px on reveal, staggered. The Alternate Framing section
reveals last and slowest because it is the emotional landing of the read.

## What this prototype intentionally lacks

No accounts, no history, no database, no analytics. No share buttons,
no toasts, no modals, no skeleton loaders. No light/dark toggle (follows
system later — light only for now). No tooltips. No tour. The product
explains itself by being used.
