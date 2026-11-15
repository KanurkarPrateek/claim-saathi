"use client";
import { useState } from "react";
import { inr, type Analysis, type Fix } from "@/lib/engine";
import { Badge, Card, t, type Lang } from "./ui";

const VERDICT = {
  likely_approved: { tone: "green", en: "Likely approved", hi: "मंज़ूरी की संभावना" },
  partial: { tone: "amber", en: "Partly paid", hi: "आंशिक भुगतान" },
  high_risk: { tone: "red", en: "At risk", hi: "जोखिम में" },
  likely_rejected: { tone: "red", en: "Likely rejected", hi: "रिजेक्ट होने की संभावना" },
} as const;

export function Verdict({ a, lang }: { a: Analysis; lang: Lang }) {
  const v = VERDICT[a.verdict];
  const avoidable = a.deductions.filter((d) => d.avoidable).reduce((s, d) => s + d.amount, 0);
  const other = Math.max(0, a.outOfPocket - avoidable);
  const pct = (n: number) => `${a.billTotal ? (n / a.billTotal) * 100 : 0}%`;
  return (
    <Card className="border-sky-200 bg-gradient-to-br from-white to-sky-50/60">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={v.tone}>{v[lang]}</Badge>
        <span className="text-xs text-slate-500">
          {a.days} {lang === "hi" ? "दिन" : a.days === 1 ? "day" : "days"} · {lang === "hi" ? "अनुमान, अंतिम निर्णय बीमा कंपनी का" : "estimate — the insurer decides"}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl">
        {lang === "hi" ? (
          <>{inr(a.billTotal)} में से लगभग <span className="text-emerald-700">{inr(a.payable)}</span> मिलेंगे</>
        ) : (
          <>You&apos;ll likely get <span className="text-emerald-700">{inr(a.payable)}</span> of {inr(a.billTotal)}</>
        )}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {lang === "hi" ? `आपकी जेब से: ${inr(a.outOfPocket)}` : `You pay: ${inr(a.outOfPocket)}`}
        {avoidable > 0 && (
          <span className="font-medium text-amber-700"> · {lang === "hi" ? `${inr(avoidable)} बचाया जा सकता था` : `${inr(avoidable)} of it was avoidable`}</span>
        )}
      </p>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Payout breakdown">
        <div className="bg-emerald-500" style={{ width: pct(a.payable) }} />
        <div className="bg-amber-400" style={{ width: pct(avoidable) }} />
        <div className="bg-rose-400" style={{ width: pct(other) }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />{lang === "hi" ? "मिलेगा" : "Paid"} {inr(a.payable)}</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400" />{lang === "hi" ? "टाला जा सकता था" : "Avoidable cut"} {inr(avoidable)}</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400" />{lang === "hi" ? "अन्य कटौती" : "Other cuts"} {inr(other)}</span>
      </div>
    </Card>
  );
}

export function Blockers({ a, lang }: { a: Analysis; lang: Lang }) {
  if (!a.blockers.length) return null;
  return (
    <div className="space-y-3">
      {a.blockers.map((b, i) => (
        <div key={i} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-rose-600">⚠</span>
            <p className="font-semibold text-rose-900">{t(b.title, lang)}</p>
          </div>
          <p className="mt-1 text-sm text-rose-900/80">{t(b.detail, lang)}</p>
          {b.clauseRef && <p className="mt-1 text-xs text-rose-700">{b.clauseRef}</p>}
        </div>
      ))}
    </div>
  );
}

const WHEN = {
  now: { en: "Do now", hi: "अभी करें", tone: "red" },
  before_admission: { en: "Before admission", hi: "भर्ती से पहले", tone: "blue" },
  before_submission: { en: "Before you submit", hi: "जमा करने से पहले", tone: "amber" },
} as const;

export function Fixes({ fixes, lang, title }: { fixes: Fix[]; lang: Lang; title?: string }) {
  if (!fixes.length) return null;
  return (
    <Card title={title ?? (lang === "hi" ? "पहले ये ठीक करें" : "Fix these first")}>
      <ol className="space-y-3">
        {fixes.map((f, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-slate-900">{t(f.title, lang)}</p>
                <Badge tone={WHEN[f.when].tone}>{WHEN[f.when][lang]}</Badge>
                {f.saves ? <Badge tone="green">{lang === "hi" ? `बचत ${inr(f.saves)}` : `saves ${inr(f.saves)}`}</Badge> : null}
              </div>
              <p className="mt-0.5 text-sm text-slate-600">{t(f.detail, lang)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function Deductions({ a, lang }: { a: Analysis; lang: Lang }) {
  const [open, setOpen] = useState(false);
  if (!a.deductions.length) return null;
  return (
    <Card title={lang === "hi" ? "पैसा क्यों कट रहा है" : "Why money is cut"}>
      <ul className="divide-y divide-slate-100">
        {a.deductions.map((d, i) => (
          <li key={i} className="py-3 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-slate-900">
                {t(d.title, lang)} {d.avoidable && <Badge tone="amber">{lang === "hi" ? "टाला जा सकता था" : "avoidable"}</Badge>}
              </p>
              <span className="shrink-0 font-semibold text-rose-700">−{inr(d.amount)}</span>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">{t(d.reason, lang)}</p>
            {d.clauseRef && <p className="mt-0.5 text-xs text-slate-400">{d.clauseRef}</p>}
          </li>
        ))}
      </ul>
      <button type="button" className="mt-2 text-sm font-medium text-sky-700 hover:underline" onClick={() => setOpen(!open)}>
        {open ? (lang === "hi" ? "लाइन-वार छुपाएँ" : "Hide line by line") : lang === "hi" ? "लाइन-वार देखें" : "See line by line"}
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="pb-1 font-medium">Item</th>
                <th className="pb-1 text-right font-medium">Billed</th>
                <th className="pb-1 text-right font-medium">Paid</th>
              </tr>
            </thead>
            <tbody>
              {a.lines.map((l) => (
                <tr key={l.index} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-2">
                    {l.item.description}
                    {l.note && <div className="text-xs text-amber-700">{t(l.note, lang)}</div>}
                  </td>
                  <td className="py-1.5 text-right text-slate-500">{inr(l.item.amount)}</td>
                  <td className={`py-1.5 text-right font-medium ${l.deducted ? "text-rose-700" : "text-slate-900"}`}>{inr(l.payable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function Deadlines({ a, lang }: { a: Analysis; lang: Lang }) {
  const tone = { ok: "green", due: "amber", late: "red", missed: "red" } as const;
  const label = {
    ok: { en: "done", hi: "हो गया" },
    due: { en: "due", hi: "बाकी" },
    late: { en: "done late", hi: "देर से" },
    missed: { en: "missed", hi: "छूट गया" },
  };
  return (
    <Card title={lang === "hi" ? "समय सीमा" : "Deadlines"}>
      <ul className="space-y-2">
        {a.deadlines.map((d, i) => (
          <li key={i} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-700">{t(d.label, lang)}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tabular-nums text-slate-500">{d.date}</span>
              <Badge tone={tone[d.status]}>{label[d.status][lang]}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Checklist({ a, lang, onToggle }: { a: Analysis; lang: Lang; onToggle: (id: string) => void }) {
  const have = a.checklist.filter((c) => c.have).length;
  return (
    <Card
      title={lang === "hi" ? "दस्तावेज़ — जो आपके पास हैं उन पर टैप करें" : "Documents — tap the ones you have"}
      right={<Badge tone={have === a.checklist.length ? "green" : "amber"}>{have}/{a.checklist.length}</Badge>}
    >
      <ul className="-mx-2">
        {a.checklist.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onToggle(c.id)} className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left active:bg-slate-50">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm ${c.have ? "bg-emerald-600 text-white" : "ring-2 ring-slate-300"}`}
                aria-hidden
              >
                {c.have ? "✓" : ""}
              </span>
              <span className={`text-sm ${c.have ? "text-slate-500" : "font-medium text-slate-900"}`}>
                {t(c.label, lang)}
                {!c.have && <span className="block text-xs font-normal text-slate-500">{c.why}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RoomCompare({
  rows,
  current,
  limit,
  lang,
}: {
  rows: { name: string; rentPerDay: number; billTotal: number; payable: number; outOfPocket: number }[];
  current: number;
  limit: number | null;
  lang: Lang;
}) {
  const best = Math.min(...rows.map((r) => r.outOfPocket));
  return (
    <Card title={lang === "hi" ? "कौन-सा कमरा लें?" : "Which room should you take?"}>
      <p className="mb-3 text-sm text-slate-600">
        {limit
          ? lang === "hi"
            ? `आपकी पॉलिसी कमरे के लिए ${inr(limit)}/दिन तक देती है। इससे महंगा कमरा लेने पर डॉक्टर, नर्सिंग और OT का बिल भी कटता है।`
            : `Your policy pays up to ${inr(limit)}/day for the room. A costlier room also cuts doctor, nursing and OT charges in the same ratio.`
          : lang === "hi"
            ? "आपकी पॉलिसी में कमरे के किराये की कोई सीमा नहीं है।"
            : "Your policy has no room-rent limit."}
      </p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const over = limit != null && r.rentPerDay > limit;
          return (
            <li
              key={r.name}
              className={`flex items-center justify-between gap-3 rounded-2xl p-3 ring-1 ${
                r.outOfPocket === best ? "bg-emerald-50 ring-emerald-200" : over ? "bg-amber-50/60 ring-amber-200" : "bg-white ring-slate-200"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">
                  {r.name} {r.rentPerDay === current && <span className="text-xs font-normal text-slate-500">({lang === "hi" ? "चुना हुआ" : "chosen"})</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {inr(r.rentPerDay)}/{lang === "hi" ? "दिन" : "day"}
                  {r.outOfPocket === best ? (
                    <> · <span className="font-medium text-emerald-700">{lang === "hi" ? "सबसे कम खर्च" : "lowest cost"}</span></>
                  ) : over ? (
                    <> · <span className="font-medium text-amber-700">{lang === "hi" ? "सीमा से ऊपर" : "over limit"}</span></>
                  ) : null}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums text-slate-900">{inr(r.outOfPocket)}</p>
                <p className="text-xs text-slate-500">{lang === "hi" ? "आपकी जेब से" : "you pay"}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
