import { extractText, getDocumentProxy } from "unpdf";
import { BillSchema, DocsSchema, PolicySchema } from "@/lib/schema";
import { extractJson, llmConfigured, LlmError, type Part } from "@/lib/llm";

export const maxDuration = 120;

const PROMPTS = {
  policy: `You read Indian health-insurance policy documents (wording, schedule or brochure) and fill in a form.
Rules:
- Dates as YYYY-MM-DD. Money in rupees as plain numbers.
- Room rent: "1% of sum insured per day" -> kind percent_of_si, value 1. "Rs 5,000 per day" -> fixed_amount, 5000. No limit / "single private room" -> none, null.
- clauseRef: the section or clause number where you found the rule, or "" if not stated.
- keywords: short lower-case words specific to that condition as it would appear in a hospital diagnosis. Avoid generic words like "eye", "joint", "replacement", "surgery".
- If something is not in the document use the usual Indian default (initial waiting 30 days, PED 36 months, emergency intimation 24 hours, planned 48 hours, claim submission 30 days). Never invent conditions or limits.`,
  bill: `You read Indian hospital final bills / discharge summaries (may be photographed, multi-page, Hindi/Marathi/English) and fill in a form.
Extract every line item with its amount after discounts. Put each into one category:
room, icu, doctor_fees, surgeon_fees, nursing, investigations, ot_procedure, pharmacy, consumables, implants, other.
Keep the description as printed (translate to English if not English). Do not merge or drop lines; do not include subtotal or total rows.
roomRentPerDay is the per-day rent of the normal (non-ICU) room. Dates as YYYY-MM-DD. Unknown text fields -> "".
isPlanned is true only if the admission was clearly scheduled in advance.`,
  docs: `You sort documents a patient will attach to an Indian health-insurance claim.
For every separate document in the input (each image or PDF may hold one or more), give its type:
claim_form, discharge_summary, itemised_bill (bill with line items), payment_receipts, investigation_reports (lab/scan reports),
prescriptions (doctor's prescription / Rx), pharmacy_bills, id_proof (Aadhaar/PAN etc.), policy_copy (policy, schedule or e-card),
cancelled_cheque, preauth_form, fir_mlc, or other.`,
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  if (!llmConfigured()) {
    return Response.json({ error: "AI reading is off: set AZURE_AI_ENDPOINT and AZURE_AI_KEY in .env.local. You can still use the sample cases or type the details." }, { status: 503 });
  }

  const form = await req.formData();
  const k = form.get("kind");
  const kind = k === "policy" || k === "docs" ? k : "bill";
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No files uploaded." }, { status: 400 });

  const parts: Part[] = [];
  for (const f of files) {
    const buf = new Uint8Array(await f.arrayBuffer());
    if (f.type === "application/pdf") {
      const pdf = await getDocumentProxy(buf);
      const { text } = await extractText(pdf, { mergePages: true });
      if (text.replace(/\s/g, "").length < 50) {
        return Response.json({ error: `"${f.name}" looks like a scanned PDF. Please upload photos/screenshots of its pages instead.` }, { status: 400 });
      }
      parts.push({ type: "text", text: `--- ${f.name} (PDF text) ---\n${text.slice(0, 200_000)}` });
    } else if (IMAGE_TYPES.includes(f.type)) {
      parts.push({ type: "image_url", image_url: { url: `data:${f.type};base64,${Buffer.from(buf).toString("base64")}` } });
    } else {
      return Response.json({ error: `Unsupported file type: ${f.type || f.name}. Use PDF, JPG or PNG.` }, { status: 400 });
    }
  }
  parts.push({
    type: "text",
    text: kind === "policy" ? "Fill the policy form from these documents." : kind === "docs" ? "Classify these documents." : "Fill the hospital bill form from these documents.",
  });

  try {
    const schema = kind === "policy" ? PolicySchema : kind === "docs" ? DocsSchema : BillSchema;
    const data = await extractJson(schema, PROMPTS[kind], parts);
    return Response.json({ kind, data });
  } catch (e) {
    if (e instanceof LlmError) return Response.json({ error: `AI error (${e.status}): ${e.message}` }, { status: e.status >= 500 || e.status === 429 ? 502 : e.status });
    if (e instanceof Error && e.name === "TimeoutError") return Response.json({ error: "Reading took too long — try fewer pages." }, { status: 504 });
    throw e;
  }
}
