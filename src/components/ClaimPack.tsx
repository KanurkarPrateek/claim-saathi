"use client";
import { inr, type Analysis } from "@/lib/engine";
import type { Bill, PatientFacts, Policy } from "@/lib/schema";
import { Card } from "./ui";

/** Printable bundle: summary, checklist, cover letter, and a grievance draft if cuts go beyond the estimate. */
export function ClaimPack({ a, policy, bill, facts, today }: { a: Analysis; policy: Policy; bill: Bill; facts: PatientFacts; today: string }) {
  const missing = a.checklist.filter((c) => !c.have);
  const cover = `To,
The Claims Department / TPA,
${policy.insurer}

Date: ${today}

Subject: ${facts.claimType === "cashless" ? "Cashless" : "Reimbursement"} claim — ${bill.patientName}, ${bill.hospitalName}, admitted ${bill.admissionDate} to ${bill.dischargeDate}

Policy: ${policy.planName} (sum insured ${inr(policy.sumInsured)})
Diagnosis: ${bill.diagnosis}
Total hospital bill: ${inr(a.billTotal)}
Insurer informed on: ${facts.intimatedAt ?? "—"}

I enclose the following documents:
${a.checklist.filter((c) => c.have).map((c, i) => `  ${i + 1}. ${c.label.en}`).join("\n")}

Kindly process the claim as per the policy terms. Please inform me in writing of any deduction, quoting the specific policy clause for each.

Yours sincerely,
${bill.patientName}`;

  const grievance = `To,
The Grievance Redressal Officer,
${policy.insurer}

Subject: Request to review deductions — ${bill.patientName}, admitted ${bill.admissionDate}

My claim for ${inr(a.billTotal)} has been settled for less than the amount payable under my policy (${policy.planName}).
As per the policy wording, I estimate the payable amount at ${inr(a.payable)}. The only deductions I expect are:
${a.deductions.filter((d) => d.kind !== "rejected").map((d) => `  • ${d.title.en}: ${inr(d.amount)} (${d.clauseRef || "policy terms"})`).join("\n") || "  • none"}

Please share the clause-wise reason for every additional deduction and settle the balance.
If I do not receive a resolution within 14 days, I will escalate to the IRDAI Bima Bharosa portal and the Insurance Ombudsman.

Yours sincerely,
${bill.patientName}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-600">Print or save as PDF and attach to your claim.</p>
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800">
          Print / save PDF
        </button>
      </div>
      <div id="claim-pack" className="space-y-4">
        <Card title="Claim summary">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-slate-500">Patient</dt><dd>{bill.patientName}</dd>
            <dt className="text-slate-500">Hospital</dt><dd>{bill.hospitalName}</dd>
            <dt className="text-slate-500">Stay</dt><dd>{bill.admissionDate} → {bill.dischargeDate}</dd>
            <dt className="text-slate-500">Bill</dt><dd>{inr(a.billTotal)}</dd>
            <dt className="text-slate-500">Expected payout</dt><dd className="font-semibold">{inr(a.payable)}</dd>
            <dt className="text-slate-500">Documents</dt><dd>{a.checklist.length - missing.length}/{a.checklist.length} ready{missing.length ? ` — missing: ${missing.map((m) => m.label.en).join(", ")}` : ""}</dd>
          </dl>
        </Card>
        <Card title="Cover letter">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">{cover}</pre>
        </Card>
        <Card title="If the insurer cuts more than this — grievance letter">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">{grievance}</pre>
        </Card>
      </div>
    </div>
  );
}
