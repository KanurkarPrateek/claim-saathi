import { z } from "zod";

/**
 * Shapes shared by the AI extractor and the rule engine.
 * The AI only fills these in from documents; every rupee is computed by engine.ts.
 */

export const ConditionRule = z.object({
  condition: z.string().describe("Plain name, e.g. 'Knee replacement'"),
  keywords: z.array(z.string()).describe("Lower-case words that identify it in a diagnosis, e.g. ['knee', 'arthroplasty']"),
  months: z.number().describe("Waiting period in months"),
  clauseRef: z.string().describe("Section / clause number in the policy, or '' if not found"),
});

export const SubLimit = z.object({
  condition: z.string(),
  keywords: z.array(z.string()),
  limit: z.number().describe("Maximum payable in rupees for this condition"),
  clauseRef: z.string(),
});

export const PolicySchema = z.object({
  insurer: z.string(),
  planName: z.string(),
  policyStartDate: z.string().describe("First inception date, YYYY-MM-DD"),
  sumInsured: z.number().describe("Sum insured in rupees"),
  roomRent: z.object({
    kind: z.enum(["none", "percent_of_si", "fixed_amount"]).describe("How the per-day room rent limit is defined"),
    value: z.number().nullable().describe("Per-day limit: percent of sum insured (e.g. 1) or rupees, null if none"),
    icuValue: z.number().nullable().describe("Per-day ICU limit, same unit as value, null if none"),
    clauseRef: z.string(),
  }),
  copayPercent: z.number().describe("Co-payment percent on every claim, 0 if none"),
  copayClauseRef: z.string(),
  initialWaitingDays: z.number().describe("Initial waiting period for non-accident claims, usually 30"),
  initialWaitingClauseRef: z.string(),
  pedWaitingMonths: z.number().describe("Pre-existing disease waiting period in months"),
  pedClauseRef: z.string(),
  specificWaiting: z.array(ConditionRule).describe("Specific-disease waiting periods"),
  subLimits: z.array(SubLimit).describe("Disease-wise caps on what is paid"),
  declaredConditions: z.array(z.string()).describe("Pre-existing conditions declared in the proposal / policy schedule"),
  intimationHoursEmergency: z.number().describe("Hours after emergency admission to inform insurer, default 24"),
  intimationHoursPlanned: z.number().describe("Hours before planned admission to inform insurer, default 48"),
  claimSubmissionDays: z.number().describe("Days after discharge to submit reimbursement documents, default 30"),
});
export type Policy = z.infer<typeof PolicySchema>;

export const ITEM_CATEGORIES = [
  "room",
  "icu",
  "doctor_fees",
  "surgeon_fees",
  "nursing",
  "investigations",
  "ot_procedure",
  "pharmacy",
  "consumables",
  "implants",
  "other",
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const BillItemSchema = z.object({
  description: z.string(),
  category: z.enum(ITEM_CATEGORIES),
  amount: z.number().describe("Rupees, after any line discount"),
});
export type BillItem = z.infer<typeof BillItemSchema>;

export const BillSchema = z.object({
  patientName: z.string(),
  hospitalName: z.string(),
  admissionDate: z.string().describe("YYYY-MM-DD"),
  dischargeDate: z.string().describe("YYYY-MM-DD"),
  diagnosis: z.string(),
  isAccident: z.boolean(),
  isPlanned: z.boolean().describe("true if the admission was scheduled in advance (e.g. planned surgery)"),
  roomType: z.string(),
  roomRentPerDay: z.number().describe("Room rent charged per day in rupees (non-ICU room)"),
  items: z.array(BillItemSchema),
});
export type Bill = z.infer<typeof BillSchema>;

/** Facts only the patient knows; asked in the UI, never extracted. */
export type PatientFacts = {
  claimType: "cashless" | "reimbursement";
  hadConditionBeforePolicy: boolean;
  intimatedAt: string | null; // YYYY-MM-DD when insurer was told, null = not yet
  documents: string[]; // ids of documents the patient has
};

export const DOC_TYPES = [
  "claim_form", "discharge_summary", "itemised_bill", "payment_receipts", "investigation_reports", "prescriptions",
  "pharmacy_bills", "id_proof", "policy_copy", "cancelled_cheque", "preauth_form", "fir_mlc", "other",
] as const;

export const DocsSchema = z.object({
  documents: z.array(
    z.object({
      type: z.enum(DOC_TYPES).describe("What this page/document is"),
      summary: z.string().describe("One short line, e.g. 'Prescription by Dr. X, 3 medicines' — no patient identifiers"),
    }),
  ),
});
export type Docs = z.infer<typeof DocsSchema>;
