"use client";
import { useRef, useState } from "react";
import { ITEM_CATEGORIES, type Bill, type Policy } from "@/lib/schema";
import { inr, roomLimit } from "@/lib/engine";
import { Field, inputCls, type Lang } from "./ui";

/** Shrink big phone photos and flatten transparency onto white (the model sees transparent pixels as black). */
async function toJpeg(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.88));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

const UPLOAD_TEXT = {
  policy: {
    en: { title: "Add your policy", sub: "PDF or photos of the policy pages", sample: "Use a sample policy" },
    hi: { title: "अपनी पॉलिसी जोड़ें", sub: "पॉलिसी के पन्नों की PDF या फोटो", sample: "सैंपल पॉलिसी इस्तेमाल करें" },
  },
  bill: {
    en: { title: "Add the hospital bill", sub: "Photo of the final bill or estimate", sample: "Use a sample bill photo" },
    hi: { title: "अस्पताल का बिल जोड़ें", sub: "फाइनल बिल या एस्टिमेट की फोटो", sample: "सैंपल बिल फोटो इस्तेमाल करें" },
  },
  docs: {
    en: { title: "Scan your documents", sub: "Prescriptions, reports, receipts — we tick the list", sample: "Use a sample document" },
    hi: { title: "अपने दस्तावेज़ स्कैन करें", sub: "पर्चे, रिपोर्ट, रसीदें — हम लिस्ट में टिक करेंगे", sample: "सैंपल दस्तावेज़ इस्तेमाल करें" },
  },
};
const SAMPLE_FILE = { policy: "/samples/sample-policy.pdf", bill: "/samples/sample-bill.jpg", docs: "/samples/sample-bill.jpg" };

export function Upload({ kind, lang, done, onData, compact = false }: { kind: "policy" | "bill" | "docs"; lang: Lang; done: boolean; onData: (d: unknown) => void; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const tx = UPLOAD_TEXT[kind][lang];

  async function send(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("kind", kind);
    try {
      for (const f of files) fd.append("files", await toJpeg(f));
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      onData(json.data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed px-4 ${compact ? "py-4" : "py-8"} text-center transition active:scale-[0.99] disabled:opacity-70 ${
          done ? "border-emerald-300 bg-emerald-50" : "border-sky-300 bg-sky-50"
        }`}
      >
        {busy ? (
          <>
            <span className="h-9 w-9 animate-spin rounded-full border-4 border-sky-300 border-t-sky-700" />
            <span className="text-base font-semibold text-sky-900">{lang === "hi" ? "पढ़ रहे हैं… (~30 सेकंड)" : "Reading… (~30 sec)"}</span>
          </>
        ) : (
          <>
            <span className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl text-white ${done ? "bg-emerald-600" : "bg-sky-700"}`} aria-hidden>
              {done ? "✓" : "📷"}
            </span>
            <span className="text-base font-semibold text-slate-900">{done ? (lang === "hi" ? "दोबारा जोड़ें" : "Add again") : tx.title}</span>
            <span className="text-sm text-slate-500">{tx.sub}</span>
          </>
        )}
      </button>
      <input ref={ref} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => send(Array.from(e.target.files ?? []))} />
      <button
        type="button"
        disabled={busy}
        className="mt-3 w-full py-2 text-sm font-medium text-sky-700 disabled:opacity-50"
        onClick={async () => {
          const path = SAMPLE_FILE[kind];
          const blob = await (await fetch(path)).blob();
          send([new File([blob], path.split("/").pop()!, { type: blob.type })]);
        }}
      >
        {tx.sample}
      </button>
      {err && <p className="mt-1 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
    </div>
  );
}

export function PolicyEditor({ policy, setPolicy }: { policy: Policy; setPolicy: (p: Policy) => void }) {
  const set = <K extends keyof Policy>(k: K, v: Policy[K]) => setPolicy({ ...policy, [k]: v });
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Sum insured (₹)">
        <input className={inputCls} inputMode="numeric" type="number" value={policy.sumInsured} onChange={(e) => set("sumInsured", +e.target.value)} />
      </Field>
      <Field label="Policy start date">
        <input className={inputCls} type="date" value={policy.policyStartDate} onChange={(e) => set("policyStartDate", e.target.value)} />
      </Field>
      <Field label="Room rent limit">
        <select className={inputCls} value={policy.roomRent.kind} onChange={(e) => set("roomRent", { ...policy.roomRent, kind: e.target.value as Policy["roomRent"]["kind"] })}>
          <option value="percent_of_si">% of sum insured</option>
          <option value="fixed_amount">₹ per day</option>
          <option value="none">No limit</option>
        </select>
      </Field>
      <Field label={policy.roomRent.kind === "percent_of_si" ? "Percent / day" : "₹ / day"}>
        <input
          className={inputCls}
          type="number"
          inputMode="decimal"
          disabled={policy.roomRent.kind === "none"}
          value={policy.roomRent.value ?? ""}
          onChange={(e) => set("roomRent", { ...policy.roomRent, value: e.target.value === "" ? null : +e.target.value })}
        />
      </Field>
      <Field label="Co-payment %">
        <input className={inputCls} type="number" inputMode="numeric" value={policy.copayPercent} onChange={(e) => set("copayPercent", +e.target.value)} />
      </Field>
      <Field label="Pre-existing wait (months)">
        <input className={inputCls} type="number" inputMode="numeric" value={policy.pedWaitingMonths} onChange={(e) => set("pedWaitingMonths", +e.target.value)} />
      </Field>
    </div>
  );
}

export function PolicySummary({ policy, lang }: { policy: Policy; lang: Lang }) {
  const limit = roomLimit(policy);
  const rows: [string, string][] = [
    [lang === "hi" ? "बीमा राशि" : "Cover", inr(policy.sumInsured)],
    [lang === "hi" ? "कमरे की सीमा" : "Room limit", limit ? `${inr(limit)}/${lang === "hi" ? "दिन" : "day"}` : lang === "hi" ? "कोई नहीं" : "None"],
    [lang === "hi" ? "को-पेमेंट" : "Co-pay", `${policy.copayPercent}%`],
    [lang === "hi" ? "शुरुआत" : "Started", policy.policyStartDate],
    [lang === "hi" ? "बीमारी-वार वेटिंग" : "Disease waits", policy.specificWaiting.map((w) => `${w.condition} ${w.months}m`).join(", ") || "—"],
  ];
  return (
    <dl className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="px-4 py-3">
        <dt className="text-xs text-slate-500">{policy.insurer}</dt>
        <dd className="font-semibold text-slate-900">{policy.planName}</dd>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BillSummary({ bill, lang }: { bill: Bill; lang: Lang }) {
  const total = bill.items.reduce((s, i) => s + i.amount, 0);
  return (
    <dl className="divide-y divide-slate-100 rounded-2xl bg-white ring-1 ring-slate-200">
      <div className="px-4 py-3">
        <dt className="text-xs text-slate-500">{bill.hospitalName}</dt>
        <dd className="font-semibold text-slate-900">{bill.patientName}</dd>
        <dd className="text-sm text-slate-600">{bill.diagnosis}</dd>
      </div>
      {(
        [
          [lang === "hi" ? "भर्ती" : "Stay", `${bill.admissionDate} → ${bill.dischargeDate}`],
          [lang === "hi" ? "कमरा" : "Room", `${bill.roomType} · ${inr(bill.roomRentPerDay)}/${lang === "hi" ? "दिन" : "day"}`],
          [lang === "hi" ? "कुल बिल" : "Total bill", `${inr(total)} · ${bill.items.length} ${lang === "hi" ? "आइटम" : "items"}`],
        ] as const
      ).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BillEditor({ bill, setBill }: { bill: Bill; setBill: (b: Bill) => void }) {
  const set = <K extends keyof Bill>(k: K, v: Bill[K]) => setBill({ ...bill, [k]: v });
  const setItem = (i: number, patch: Partial<Bill["items"][number]>) => set("items", bill.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Admission">
          <input className={inputCls} type="date" value={bill.admissionDate} onChange={(e) => set("admissionDate", e.target.value)} />
        </Field>
        <Field label="Discharge">
          <input className={inputCls} type="date" value={bill.dischargeDate} onChange={(e) => set("dischargeDate", e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Field label="Diagnosis">
            <input className={inputCls} value={bill.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} />
          </Field>
        </div>
        <Field label="Room type">
          <input className={inputCls} value={bill.roomType} onChange={(e) => set("roomType", e.target.value)} />
        </Field>
        <Field label="Room ₹ / day">
          <input className={inputCls} type="number" inputMode="numeric" value={bill.roomRentPerDay} onChange={(e) => set("roomRentPerDay", +e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-5 text-sm text-slate-700">
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={bill.isPlanned} onChange={(e) => set("isPlanned", e.target.checked)} /> Planned</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={bill.isAccident} onChange={(e) => set("isAccident", e.target.checked)} /> Accident</label>
      </div>
      <p className="pt-2 text-xs font-medium text-slate-500">Bill lines</p>
      <ul className="space-y-2">
        {bill.items.map((it, i) => (
          <li key={i} className="rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-200">
            <div className="flex gap-2">
              <input className={inputCls} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} aria-label="Item" />
              <button type="button" aria-label="Remove line" className="px-2 text-slate-400" onClick={() => set("items", bill.items.filter((_, j) => j !== i))}>✕</button>
            </div>
            <div className="mt-2 flex gap-2">
              <select className={inputCls} value={it.category} onChange={(e) => setItem(i, { category: e.target.value as typeof it.category })} aria-label="Type">
                {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
              <input className={`${inputCls} w-32 text-right`} type="number" inputMode="numeric" value={it.amount} onChange={(e) => setItem(i, { amount: +e.target.value })} aria-label="Amount" />
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="text-sm font-medium text-sky-700" onClick={() => set("items", [...bill.items, { description: "", category: "other", amount: 0 }])}>+ Add line</button>
    </div>
  );
}

/** Fields the documents didn't contain (e.g. a generic policy wording has no sum insured). Ask for them up front. */
export function missingPolicy(p: Policy) {
  return { sumInsured: !(p.sumInsured > 0), policyStartDate: !/^\d{4}-\d{2}-\d{2}$/.test(p.policyStartDate) };
}
export function missingBill(b: Bill) {
  const date = (s: string) => !/^\d{4}-\d{2}-\d{2}$/.test(s);
  return {
    admissionDate: date(b.admissionDate),
    dischargeDate: date(b.dischargeDate),
    diagnosis: !b.diagnosis.trim(),
    roomRentPerDay: !(b.roomRentPerDay > 0) && b.items.some((i) => i.category === "room"),
  };
}
export const anyMissing = (m: Record<string, boolean>) => Object.values(m).some(Boolean);

function MissingShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="font-semibold text-amber-900">{lang === "hi" ? "ये दस्तावेज़ में नहीं मिला — कृपया भरें" : "Not in the document — please fill these"}</p>
      {children}
    </div>
  );
}

export function MissingPolicyFields({ policy, setPolicy, lang }: { policy: Policy; setPolicy: (p: Policy) => void; lang: Lang }) {
  const [ask] = useState(() => missingPolicy(policy)); // remember what was missing so inputs don't vanish mid-typing
  if (!anyMissing(ask)) return null;
  return (
    <MissingShell lang={lang}>
      {ask.sumInsured && (
        <Field label={lang === "hi" ? "बीमा राशि (₹) — पॉलिसी शेड्यूल / ई-कार्ड पर" : "Sum insured (₹) — on your policy schedule / e-card"}>
          <input className={inputCls} type="number" inputMode="numeric" placeholder="500000" value={policy.sumInsured || ""} onChange={(e) => setPolicy({ ...policy, sumInsured: +e.target.value })} />
        </Field>
      )}
      {ask.policyStartDate && (
        <Field label={lang === "hi" ? "पॉलिसी पहली बार कब ली?" : "When did the policy first start?"}>
          <input className={inputCls} type="date" value={policy.policyStartDate} onChange={(e) => setPolicy({ ...policy, policyStartDate: e.target.value })} />
        </Field>
      )}
    </MissingShell>
  );
}

export function MissingBillFields({ bill, setBill, lang }: { bill: Bill; setBill: (b: Bill) => void; lang: Lang }) {
  const [ask] = useState(() => missingBill(bill));
  if (!anyMissing(ask)) return null;
  const hi = lang === "hi";
  return (
    <MissingShell lang={lang}>
      {ask.admissionDate && (
        <Field label={hi ? "भर्ती की तारीख" : "Admission date"}>
          <input className={inputCls} type="date" value={bill.admissionDate} onChange={(e) => setBill({ ...bill, admissionDate: e.target.value })} />
        </Field>
      )}
      {ask.dischargeDate && (
        <Field label={hi ? "डिस्चार्ज की तारीख" : "Discharge date"}>
          <input className={inputCls} type="date" value={bill.dischargeDate} onChange={(e) => setBill({ ...bill, dischargeDate: e.target.value })} />
        </Field>
      )}
      {ask.diagnosis && (
        <Field label={hi ? "बीमारी / इलाज" : "Illness / treatment"}>
          <input className={inputCls} placeholder={hi ? "जैसे: डेंगू" : "e.g. Dengue"} value={bill.diagnosis} onChange={(e) => setBill({ ...bill, diagnosis: e.target.value })} />
        </Field>
      )}
      {ask.roomRentPerDay && (
        <Field label={hi ? "कमरे का किराया ₹/दिन (टैरिफ पर)" : "Room rent ₹ per day (from the tariff)"}>
          <input className={inputCls} type="number" inputMode="numeric" value={bill.roomRentPerDay || ""} onChange={(e) => setBill({ ...bill, roomRentPerDay: +e.target.value })} />
        </Field>
      )}
    </MissingShell>
  );
}
