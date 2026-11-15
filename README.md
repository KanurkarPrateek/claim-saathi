# Claim Saathi

**Fix your health-insurance claim before it fails.** Paytm Build for India AI Hackathon — Track 2, AI-Powered Financial Journeys.

Most Indian health claims are cut or rejected for reasons the patient could have known in advance: a room above the policy's rent limit (which also cuts doctor, nursing and OT charges in the same ratio), waiting periods, non-medical items, missing documents and late intimation. People find out only after the claim is decided.

Claim Saathi checks the claim at the three moments that matter:

1. **Before admission:** which room to take (out-of-pocket for each room on the hospital's tariff), and whether a waiting period will reject a planned surgery, with the date it becomes safe.
2. **At discharge:** expected payout, every rupee cut with its reason and policy clause, which cuts were avoidable, missing documents and deadlines.
3. **Claim pack:** printable summary, a cover letter, and a grievance letter to use if the insurer cuts more than the estimate.

English / हिन्दी toggle throughout.

## How it works

- **The AI only reads documents.** A policy PDF and photos of the hospital bill go to Kimi‑K3.1‑Pro (Azure AI Foundry), which returns structured JSON validated with zod (`src/lib/llm.ts`, `src/app/api/extract/route.ts`). The user can review and edit every extracted field.
- **A rule engine calculates every rupee** (`src/lib/engine.ts`, `src/lib/rules.ts`): room-rent caps, proportionate deduction, IRDAI non-payable items, sub-limits, co-pay, sum-insured cap, initial / specific-disease / pre-existing-disease waiting periods, non-disclosure risk, document checklist, intimation and submission deadlines. It is deterministic and unit-tested (`npm test`), so the numbers never hallucinate.

## Run

```bash
npm install
cp .env.example .env.local   # fill in the Azure endpoint + key
NODE_OPTIONS=--no-experimental-webstorage npm run dev   # Node 25 needs this flag
# open http://localhost:3000
```

Without a key, the sample cases and manual editing still work; only document upload is off.

`npm test` runs the engine tests. `npm run build` builds for production.

## Built-in demo

Tap **▶ Watch the 1-minute demo** on the home screen, or open `/?demo=tour` to start it straight away. It plays 14 captioned scenes by itself: Ramesh's discharge → the hidden cut → the claim pack → Sunita's knee surgery → Hindi. There are pause, back, next and exit controls. The scenes live in `src/components/DemoTour.tsx`.

## 3-minute demo script (on a phone)

Phone-first flow, 4 steps: **pick your situation → policy → bill → 3 taps → result.** Deep links open an example straight away: `/?demo=dengue`, `/?demo=knee`, `/?demo=appendix`.

1. Tap **Being discharged** → **Use a sample policy** → *Next* → **Use a sample bill photo** (the AI reads each in ~25 s) → answer the 3 taps → **See my result**: "You'll likely get ₹52,500 of ₹74,900 — ₹17,200 of it was avoidable."
2. Scroll: the hidden proportionate deduction with its policy clause; tap the documents you have; deadlines.
3. **Get claim pack** → cover letter + grievance letter → *Save PDF*.
4. Back to home → **Sunita · knee replacement**: likely rejected (24-month waiting period). The app gives the date it becomes covered, shows the room that costs ₹0 once covered, and tells her to inform the insurer by 30 Nov.
5. Tap **हिन्दी** to show the result in Hindi.

Demo insurer, patients and documents are fictional (`src/lib/samples.ts`, `public/samples/`).
