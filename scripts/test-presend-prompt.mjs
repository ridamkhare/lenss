#!/usr/bin/env node
// Prompt validation for Lens Draft Check (Email vertical).
// Runs the per-recipient analysis + meta-pattern synthesis on real email drafts,
// against opus-4.7 at low temperature, prints human-readable output.
// No commits, no production change — pure validation.

import fs from "node:fs";

const ENV_PATH = "/Users/ridamkhare/Downloads/lenss/.env.local";
const MODEL = "anthropic/claude-opus-4.7";
const TEMP = 0.2;
const MAX_TOKENS_PER_RECIPIENT = 600;
const MAX_TOKENS_META = 400;

const env = Object.fromEntries(
  fs.readFileSync(ENV_PATH, "utf8")
    .split("\n").filter(l => l.includes("="))
    .map(l => l.split("=", 2).map(s => s.trim().replace(/^"|"$/g, "")))
);
const KEY = env.OPENROUTER_API_KEY;
if (!KEY) { console.error("OPENROUTER_API_KEY missing"); process.exit(1); }

// ---------- PER-RECIPIENT PROMPT ----------
const PER_RECIPIENT_PROMPT = `You are a perceptual instrument for a writer about to send an email. The writer pastes their draft (subject + body), names ONE recipient archetype, and optionally adds a one-line note about the actual person. Read the email AS THAT RECIPIENT WOULD RECEIVE IT — not as a neutral observer, not as the writer. Surface what the email is doing TO THEM.

You return JSON only. No prose outside the JSON.

OUTPUT SHAPE

{
  "subject_notice": "<one sentence: what the subject line is doing to this recipient. Must contain a verbatim quote from the subject in double quotes.>",
  "body_notice": "<one sentence: what the body is doing to this recipient. Must fuse observation and consequence — what the writing does AND what the recipient receives — joined by 'so', 'before', 'after', 'instead of', or equivalent structural connector. Must contain a 2-to-8 word verbatim quote from the body in double quotes.>",
  "reply_likelihood": {
    "action": "<one of: reply | ignore | escalate | push_back | ghost>",
    "reason": "<one sentence naming what makes that the likeliest next move>"
  }
}

ACTION DEFINITIONS

- reply: recipient responds substantively to the request/topic as framed
- ignore: recipient sees it, takes no action, doesn't respond
- escalate: recipient forwards it, brings in someone else, or makes it bigger
- push_back: recipient responds but challenges, redirects, or rejects
- ghost: recipient deliberately leaves it unanswered with no plan to respond

VOICE

Same Lens voice as always: perceptive, grounded, precise. Read the email as writing. Name what the recipient receives — the posture, the calibration, the positioning — not what the email "is" in category terms. Never apologize, never philosophize.

BANNED VOCABULARY (rewrite without them, or refuse)

- Hedge softeners: subtly, quietly, gently, softly, slightly (when modifying perceptive verbs)
- Hedge phrases: perhaps, arguably, it could be said, one could argue, some might say
- Interpretive jargon: ontological, epistemic, hegemonic, semantic gravity, interpretive structure
- Coaching constructions: try X, consider Y, you should, if you want X try Y, be more X — NEVER. You are perceptual, not directive.
- Taxonomic openers: "This is a polite email" / "This reads as formal" — never categorize, always observe.

REFUSAL

Return {"declined": true, "reason": "<one calm sentence>"} only when:
- The email is too short to read meaningfully (under 30 characters of body)
- The body is raw code, a bare URL, or a one-word reply
- The strongest reading would be generic (could apply to any email)

NEVER prescribe rewrites. NEVER tell the writer what to change. Just name what is happening.`;

// ---------- META-PATTERN PROMPT ----------
const META_PROMPT = `You are given multiple perceptual readings of the SAME email, one per recipient archetype. Identify the SINGLE recurring move that appears across them — the move the email makes regardless of who receives it. Then issue a send-readiness verdict.

Return JSON only:

{
  "meta_pattern": "<one sentence naming the cross-recipient move. Must be specific to this email, not a general observation about email writing.>",
  "send_readiness": "<one of: ship | review | reconsider>",
  "send_readiness_reason": "<one sentence>"
}

VERDICT DEFINITIONS

- ship: the email is doing what the writer almost certainly intends; differences across recipients are not material
- review: there is one specific notice the writer should sit with before sending — usually because the email is doing something across all recipients that may not be intended
- reconsider: the email is doing something materially different from what the writer likely intends, and sending as-is carries real cost

VOICE: same Lens voice. No coaching constructions. The verdict is perceptual, not prescriptive.`;

// ---------- TEST DRAFTS ----------
const DRAFTS = [
  {
    label: "raise-ask",
    subject: "Quick chat?",
    body: "Hi, I was hoping we could find some time to discuss my role and compensation. I know things have been busy and I don't want to add to your plate, but I think it might be worth a conversation when you have a moment. I've been here for a while now and just wanted to see if we could check in. Let me know what works for your schedule. Thanks!",
    recipients: [
      { archetype: "boss", context: "conflict-avoidant; tends to defer hard conversations" },
      { archetype: "peer", context: null },
    ],
  },
  {
    label: "customer-followup",
    subject: "Re: Pricing for enterprise plan",
    body: "Hey, just circling back on the email I sent last week about our enterprise pricing. I know you mentioned you'd loop in your CTO — let me know if there's anything I can do to help move things along, or if there's a better time for us to chat. Happy to send over a deck if it'd help your internal discussion. Looking forward to hearing from you!",
    recipients: [
      { archetype: "customer", context: "evaluating us against two competitors" },
      { archetype: "investor", context: null },
    ],
  },
  {
    label: "decline-meeting",
    subject: "Re: Catch-up next week",
    body: "Hey! Thanks so much for thinking of me. Unfortunately my calendar is really packed next week and I don't think I'll be able to make it work. Maybe we can find some time later in the month? Sorry to push this back — would love to connect when things calm down on my end.",
    recipients: [
      { archetype: "peer", context: null },
      { archetype: "boss", context: "asked for the meeting; senior to me by two levels" },
    ],
  },
];

// ---------- CALLS ----------
async function call(systemPrompt, userMessage, maxTokens) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "lens",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: TEMP,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { error: `HTTP ${res.status}: ${txt.slice(0, 300)}` };
  }
  const json = await res.json();
  return { content: json?.choices?.[0]?.message?.content ?? "" };
}

function extractJson(raw) {
  if (!raw) return null;
  const s = raw.indexOf("{"); const e = raw.lastIndexOf("}");
  if (s < 0 || e < 0) return null;
  try { return JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
}

function userPromptForRecipient(draft, recipient) {
  return `SUBJECT: ${draft.subject}

BODY:
${draft.body}

RECIPIENT ARCHETYPE: ${recipient.archetype}${recipient.context ? `
CONTEXT ABOUT THIS RECIPIENT: ${recipient.context}` : ""}`;
}

function userPromptForMeta(draft, perRecipientResults) {
  return `EMAIL (the same one read by each recipient):

SUBJECT: ${draft.subject}

BODY:
${draft.body}

PER-RECIPIENT READINGS:
${JSON.stringify(perRecipientResults, null, 2)}`;
}

(async () => {
  console.log(`# Lens Draft Check — Email vertical prompt validation`);
  console.log(`# Model: ${MODEL} | Temp: ${TEMP}\n`);

  for (const draft of DRAFTS) {
    console.log(`\n${"=".repeat(72)}`);
    console.log(`# DRAFT: ${draft.label}`);
    console.log(`${"=".repeat(72)}`);
    console.log(`Subject: ${draft.subject}`);
    console.log(`Body: ${draft.body.slice(0, 160)}${draft.body.length > 160 ? "…" : ""}\n`);

    // Per-recipient calls in parallel
    const perRecipientPromises = draft.recipients.map(r =>
      call(PER_RECIPIENT_PROMPT, userPromptForRecipient(draft, r), MAX_TOKENS_PER_RECIPIENT)
        .then(r2 => ({ recipient: r, parsed: extractJson(r2.content), raw: r2 }))
    );
    const perResults = await Promise.all(perRecipientPromises);

    for (const { recipient, parsed, raw } of perResults) {
      console.log(`\n──── recipient: ${recipient.archetype}${recipient.context ? ` (${recipient.context.slice(0, 50)})` : ""} ────`);
      if (!parsed) { console.log(`  (parse failed)`); console.log(`  raw: ${(raw.content || raw.error || "").slice(0, 200)}`); continue; }
      if (parsed.declined) { console.log(`  DECLINED: ${parsed.reason}`); continue; }
      console.log(`  subject_notice: ${parsed.subject_notice}`);
      console.log(`  body_notice:    ${parsed.body_notice}`);
      console.log(`  reply_likelihood: ${parsed.reply_likelihood?.action} — ${parsed.reply_likelihood?.reason}`);
    }

    // Meta-pattern synthesis
    const validPer = perResults.filter(r => r.parsed && !r.parsed.declined).map(r => ({
      recipient: r.recipient.archetype,
      context: r.recipient.context,
      ...r.parsed,
    }));
    if (validPer.length >= 2) {
      const metaRaw = await call(META_PROMPT, userPromptForMeta(draft, validPer), MAX_TOKENS_META);
      const meta = extractJson(metaRaw.content);
      console.log(`\n──── meta-pattern + send-readiness ────`);
      if (meta) {
        console.log(`  meta_pattern:        ${meta.meta_pattern}`);
        console.log(`  send_readiness:      ${meta.send_readiness}`);
        console.log(`  readiness_reason:    ${meta.send_readiness_reason}`);
      } else {
        console.log(`  (meta parse failed)`);
        console.log(`  raw: ${(metaRaw.content || metaRaw.error || "").slice(0, 200)}`);
      }
    }
  }
  console.log(`\n${"=".repeat(72)}\nDone.\n`);
})();
