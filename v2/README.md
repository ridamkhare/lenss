# V2 — Lenss

V2 is an **optional, isolated layer** on top of V1. It exists to reveal
one additional grounded interaction-dynamic per reading — never two,
never deeper analysis.

## Architecture

V1 is untouched. Every V1 file in `app/`, `components/`, and `lib/`
remains as it was on the `behavioral-refactor-v1` branch.

V2 lives entirely inside:

```
v2/
├── app/              # V2 page components — re-export from app/v2/* shims
│   ├── page.tsx
│   ├── yours/page.tsx
│   ├── compare/page.tsx
│   └── api/noticeHandler.ts
├── components/
│   └── lens/NoticedMore.tsx   # the single affordance + reveal
├── lib/
│   ├── noticeTypes.ts
│   ├── noticePrompt.ts
│   └── noticeClient.ts
└── server/
    └── noticeAnalyze.ts       # model call + validators
```

Plus four thin Next.js shims (required by file-based routing — they
contain no logic, only `export { default } from "@/v2/..."`):

```
app/v2/page.tsx
app/v2/yours/page.tsx
app/v2/compare/page.tsx
app/api/v2/notice/route.ts
```

## How V2 reaches the user

V1 routes (`/`, `/yours`, `/compare`) are unchanged. V2 lives at:

- `/v2`           — Read mode with V2 affordance
- `/v2/yours`     — Yours mode with V2 affordance
- `/v2/compare`   — Compare mode with V2 affordance

V2 pages call V1's existing endpoints (`/api/reveal`, `/api/read`,
`/api/compare`) for the V1 reading. V2's own endpoint
(`/api/v2/notice`) is called only after a V1 response is shown, and
only if the user clicks the affordance.

## The affordance

After V1's Save and Another buttons, separated by a divider:

> Lenss noticed one more thing.  ·  show

On click, the V2 endpoint returns either:

- one grounded sentence anchored to a verbatim phrase, or
- a quiet decline ("Nothing further distinct enough to surface.")

The sophistication of V2 lives in what it chooses not to surface.

## Reverting

V2 is fully additive. To roll back to V1:

```bash
git checkout behavioral-refactor-v1
git branch -D v2-rebuild
```

Or, to keep the branch but remove V2 surface:

```bash
rm -rf v2/ app/v2/ app/api/v2/
```

No V1 file is modified by V2.
