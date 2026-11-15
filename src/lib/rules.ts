import type { ItemCategory } from "./schema";

/**
 * Items insurers commonly refuse to pay for, based on the IRDAI list of
 * non-medical / optional items. Matched against bill line descriptions.
 */
export const NON_PAYABLE: { label: string; keywords: string[] }[] = [
  { label: "Gloves / masks / PPE", keywords: ["glove", "mask", "ppe", "face shield"] },
  { label: "Admission / registration charges", keywords: ["registration", "admission charge", "admission fee", "file charge"] },
  { label: "Admission kit / toiletries", keywords: ["admission kit", "toiletr", "soap", "toothbrush", "toothpaste", "comb", "slipper", "towel"] },
  { label: "Attendant food / diet", keywords: ["attendant", "visitor", "guest meal", "companion"] },
  { label: "Diapers / baby items", keywords: ["diaper", "baby food", "baby oil"] },
  { label: "Sanitiser / disinfectant", keywords: ["sanitiser", "sanitizer", "disinfectant", "hand wash"] },
  { label: "TV / phone / internet", keywords: ["television", "tv charge", "telephone", "wifi", "internet"] },
  { label: "Documentation / certificates", keywords: ["documentation", "medical record", "certificate", "mrd charge"] },
  { label: "Laundry", keywords: ["laundry"] },
  { label: "Thermometer / nebuliser kit / cold pack", keywords: ["thermometer", "nebuliser kit", "nebulizer kit", "cold pack", "hot pack"] },
  { label: "Service / luxury tax", keywords: ["service charge", "luxury tax"] },
];

/**
 * When the room costs more than the policy limit, insurers cut these
 * "associated" charges in the same ratio (proportionate deduction).
 * IRDAI circular IRDAI/HLT/REG/CIR/151/06/2020 bars the cut on pharmacy,
 * consumables, implants/devices, diagnostics and ICU charges, and at hospitals
 * without room-wise differential billing.
 */
export const PROPORTIONATE_CATEGORIES: ItemCategory[] = ["doctor_fees", "surgeon_fees", "nursing", "ot_procedure", "other"];

export type DocId =
  | "claim_form"
  | "discharge_summary"
  | "itemised_bill"
  | "payment_receipts"
  | "investigation_reports"
  | "prescriptions"
  | "pharmacy_bills"
  | "id_proof"
  | "policy_copy"
  | "cancelled_cheque"
  | "preauth_form"
  | "fir_mlc";

export const DOCUMENTS: { id: DocId; en: string; hi: string; why: string }[] = [
  { id: "claim_form", en: "Signed claim form (Part A)", hi: "हस्ताक्षरित क्लेम फॉर्म (भाग A)", why: "Insurer will not open the claim without it." },
  { id: "preauth_form", en: "Pre-authorisation form (from hospital TPA desk)", hi: "प्री-ऑथराइज़ेशन फॉर्म (अस्पताल TPA डेस्क से)", why: "Needed for cashless approval." },
  { id: "discharge_summary", en: "Discharge summary (original)", hi: "डिस्चार्ज समरी (मूल)", why: "Proves diagnosis and treatment." },
  { id: "itemised_bill", en: "Itemised final bill (not just the total)", hi: "आइटम-वार फाइनल बिल (सिर्फ टोटल नहीं)", why: "Most common reason for a query letter." },
  { id: "payment_receipts", en: "Payment receipts", hi: "भुगतान रसीदें", why: "Proves you paid the hospital." },
  { id: "investigation_reports", en: "Lab / scan reports", hi: "लैब / स्कैन रिपोर्ट", why: "Supports the diagnosis." },
  { id: "prescriptions", en: "Doctor's prescriptions", hi: "डॉक्टर के पर्चे", why: "Links medicines to treatment." },
  { id: "pharmacy_bills", en: "Pharmacy bills with prescriptions", hi: "पर्चे के साथ दवा के बिल", why: "Unlinked medicine bills are cut." },
  { id: "id_proof", en: "Patient ID proof (Aadhaar / PAN)", hi: "मरीज़ का पहचान पत्र (आधार / पैन)", why: "KYC of the claimant." },
  { id: "policy_copy", en: "Policy copy / e-card", hi: "पॉलिसी कॉपी / ई-कार्ड", why: "Identifies the cover." },
  { id: "cancelled_cheque", en: "Cancelled cheque / bank details", hi: "कैंसल्ड चेक / बैंक विवरण", why: "Where the money is sent." },
  { id: "fir_mlc", en: "FIR / MLC copy (accidents)", hi: "FIR / MLC कॉपी (दुर्घटना)", why: "Mandatory for accident claims." },
];

export function requiredDocs(claimType: "cashless" | "reimbursement", isAccident: boolean): DocId[] {
  const base: DocId[] = ["claim_form", "discharge_summary", "itemised_bill", "investigation_reports", "prescriptions", "id_proof", "policy_copy"];
  if (claimType === "cashless") base.push("preauth_form");
  else base.push("payment_receipts", "pharmacy_bills", "cancelled_cheque");
  if (isAccident) base.push("fir_mlc");
  return base;
}
