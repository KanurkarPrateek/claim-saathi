import type { Bill, BillItem, PatientFacts, Policy } from "./schema";
import { DOCUMENTS, NON_PAYABLE, PROPORTIONATE_CATEGORIES, requiredDocs, type DocId } from "./rules";

export type Text = { en: string; hi: string };
export type DeductionKind = "non_payable" | "room_excess" | "proportionate" | "sublimit" | "copay" | "si_cap" | "rejected";

export type LineResult = {
  index: number;
  item: BillItem;
  payable: number;
  deducted: number;
  kind: DeductionKind | null;
  note: Text | null;
};

export type DeductionGroup = { kind: DeductionKind; amount: number; title: Text; reason: Text; clauseRef: string; avoidable: boolean };

export type Blocker = {
  code: "initial_waiting" | "specific_waiting" | "ped_waiting" | "ped_not_declared";
  severity: "reject" | "high_risk";
  title: Text;
  detail: Text;
  clauseRef: string;
};

export type Fix = { title: Text; detail: Text; saves: number | null; when: "before_admission" | "now" | "before_submission" };

export type Deadline = { label: Text; date: string; status: "ok" | "due" | "late" | "missed" };

export type Analysis = {
  days: number;
  roomLimitPerDay: number | null;
  billTotal: number;
  payable: number;
  outOfPocket: number;
  verdict: "likely_approved" | "partial" | "high_risk" | "likely_rejected";
  lines: LineResult[];
  deductions: DeductionGroup[];
  blockers: Blocker[];
  fixes: Fix[];
  checklist: { id: DocId; label: Text; why: string; have: boolean }[];
  deadlines: Deadline[];
};

// ---------- helpers ----------

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

const DAY = 86_400_000;
const toDate = (s: string) => new Date(s + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
const addMonths = (s: string, m: number) => {
  const d = toDate(s);
  d.setUTCMonth(d.getUTCMonth() + m);
  return iso(d);
};
const daysBetween = (a: string, b: string) => {
  const d = Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
  return Number.isFinite(d) ? d : 0;
};
const matches = (text: string, keywords: string[]) => {
  const t = text.toLowerCase();
  return keywords.some((k) => k && t.includes(k.toLowerCase()));
};
const round = (n: number) => Math.round(n);

export function roomLimit(policy: Policy): number | null {
  const { kind, value } = policy.roomRent;
  if (kind === "none" || value == null) return null;
  return kind === "percent_of_si" ? (value * policy.sumInsured) / 100 : value;
}

// ---------- main ----------

export function analyze(policy: Policy, bill: Bill, facts: PatientFacts, today: string): Analysis {
  const days = Math.max(1, daysBetween(bill.admissionDate, bill.dischargeDate));
  const limit = roomLimit(policy);
  const ratio = limit != null && bill.roomRentPerDay > limit ? limit / bill.roomRentPerDay : 1;
  let roomCapLeft = limit != null ? limit * days : Infinity;

  const lines: LineResult[] = bill.items.map((item, index) => {
    const np = NON_PAYABLE.find((n) => matches(item.description, n.keywords));
    if (np) {
      return {
        index, item, payable: 0, deducted: item.amount, kind: "non_payable",
        note: { en: `Non-medical item (${np.label}) — never paid`, hi: `गैर-चिकित्सा आइटम (${np.label}) — कभी नहीं मिलता` },
      };
    }
    if (item.category === "room") {
      const pay = Math.min(item.amount, roomCapLeft);
      roomCapLeft -= pay;
      const cut = item.amount - pay;
      return {
        index, item, payable: pay, deducted: cut, kind: cut > 0 ? "room_excess" : null,
        note: cut > 0 ? { en: `Room above ${inr(limit!)}/day limit`, hi: `कमरा ${inr(limit!)}/दिन की सीमा से ऊपर` } : null,
      };
    }
    if (ratio < 1 && PROPORTIONATE_CATEGORIES.includes(item.category)) {
      const pay = item.amount * ratio;
      return {
        index, item, payable: pay, deducted: item.amount - pay, kind: "proportionate",
        note: {
          en: `Cut to ${Math.round(ratio * 100)}% because the room was costlier than allowed`,
          hi: `महंगे कमरे की वजह से ${Math.round(ratio * 100)}% तक घटाया गया`,
        },
      };
    }
    return { index, item, payable: item.amount, deducted: 0, kind: null, note: null };
  });

  const billTotal = bill.items.reduce((s, i) => s + i.amount, 0);
  const sumKind = (k: DeductionKind) => lines.filter((l) => l.kind === k).reduce((s, l) => s + l.deducted, 0);
  let admissible = lines.reduce((s, l) => s + l.payable, 0);

  const deductions: DeductionGroup[] = [];
  const npTotal = sumKind("non_payable");
  if (npTotal > 0)
    deductions.push({
      kind: "non_payable", amount: npTotal, avoidable: false, clauseRef: "IRDAI list of non-payable items",
      title: { en: "Non-medical items", hi: "गैर-चिकित्सा आइटम" },
      reason: { en: "Gloves, kits, registration, attendant food etc. are not covered by any Indian health policy.", hi: "दस्ताने, किट, रजिस्ट्रेशन, साथी का खाना आदि किसी भी पॉलिसी में कवर नहीं होते।" },
    });
  const roomExcess = sumKind("room_excess");
  if (roomExcess > 0)
    deductions.push({
      kind: "room_excess", amount: roomExcess, avoidable: true, clauseRef: policy.roomRent.clauseRef,
      title: { en: "Room rent above limit", hi: "कमरे का किराया सीमा से ज़्यादा" },
      reason: {
        en: `Your policy pays up to ${inr(limit!)}/day for the room. You were in a ${inr(bill.roomRentPerDay)}/day room.`,
        hi: `आपकी पॉलिसी कमरे के लिए ${inr(limit!)}/दिन तक देती है। आप ${inr(bill.roomRentPerDay)}/दिन वाले कमरे में थे।`,
      },
    });
  const prop = sumKind("proportionate");
  if (prop > 0)
    deductions.push({
      kind: "proportionate", amount: prop, avoidable: true, clauseRef: policy.roomRent.clauseRef,
      title: { en: "Hidden cut: proportionate deduction", hi: "छुपी कटौती: अनुपातिक कटौती" },
      reason: {
        en: `Because the room cost ${Math.round((1 / ratio) * 100)}% of the limit, doctor, nursing and OT / procedure charges are also paid only at ${Math.round(ratio * 100)}%. Medicines, tests, implants and ICU can't be cut this way (IRDAI rule).`,
        hi: `कमरा सीमा का ${Math.round((1 / ratio) * 100)}% था, इसलिए डॉक्टर, नर्सिंग और OT/प्रोसीजर का भी सिर्फ ${Math.round(ratio * 100)}% मिलेगा। दवाइयाँ, टेस्ट, इम्प्लांट और ICU ऐसे नहीं कट सकते (IRDAI नियम)।`,
      },
    });

  const sub = policy.subLimits.find((s) => matches(bill.diagnosis, s.keywords));
  if (sub && admissible > sub.limit) {
    const cut = admissible - sub.limit;
    admissible = sub.limit;
    deductions.push({
      kind: "sublimit", amount: cut, avoidable: false, clauseRef: sub.clauseRef,
      title: { en: `Cap for ${sub.condition}`, hi: `${sub.condition} की अधिकतम सीमा` },
      reason: { en: `Your policy pays at most ${inr(sub.limit)} for ${sub.condition}.`, hi: `${sub.condition} के लिए पॉलिसी अधिकतम ${inr(sub.limit)} देती है।` },
    });
  }

  if (policy.copayPercent > 0) {
    const cut = (admissible * policy.copayPercent) / 100;
    admissible -= cut;
    deductions.push({
      kind: "copay", amount: cut, avoidable: false, clauseRef: policy.copayClauseRef,
      title: { en: `${policy.copayPercent}% co-payment`, hi: `${policy.copayPercent}% को-पेमेंट` },
      reason: { en: `You pay ${policy.copayPercent}% of every claim yourself.`, hi: `हर क्लेम का ${policy.copayPercent}% आपको खुद देना होता है।` },
    });
  }

  if (admissible > policy.sumInsured) {
    const cut = admissible - policy.sumInsured;
    admissible = policy.sumInsured;
    deductions.push({
      kind: "si_cap", amount: cut, avoidable: false, clauseRef: "Policy schedule",
      title: { en: "Above sum insured", hi: "बीमा राशि से ज़्यादा" },
      reason: { en: `Total cover is ${inr(policy.sumInsured)}.`, hi: `कुल कवर ${inr(policy.sumInsured)} है।` },
    });
  }

  // ---------- blockers (whole claim at risk) ----------
  const blockers: Blocker[] = [];
  const fixes: Fix[] = [];
  const sinceStart = daysBetween(policy.policyStartDate, bill.admissionDate);

  if (!bill.isAccident && sinceStart < policy.initialWaitingDays) {
    const ok = addDays(policy.policyStartDate, policy.initialWaitingDays);
    blockers.push({
      code: "initial_waiting", severity: "reject", clauseRef: policy.initialWaitingClauseRef,
      title: { en: "Inside the first-days waiting period", hi: "शुरुआती वेटिंग पीरियड के अंदर" },
      detail: {
        en: `Only accidents are covered in the first ${policy.initialWaitingDays} days. Cover for illness starts on ${ok}.`,
        hi: `पहले ${policy.initialWaitingDays} दिनों में सिर्फ दुर्घटना कवर होती है। बीमारी का कवर ${ok} से शुरू होगा।`,
      },
    });
  }

  for (const w of policy.specificWaiting) {
    if (!matches(bill.diagnosis, w.keywords)) continue;
    const ok = addMonths(policy.policyStartDate, w.months);
    if (bill.admissionDate < ok) {
      blockers.push({
        code: "specific_waiting", severity: "reject", clauseRef: w.clauseRef,
        title: { en: `${w.condition}: ${w.months}-month waiting period`, hi: `${w.condition}: ${w.months} महीने का वेटिंग पीरियड` },
        detail: {
          en: `${w.condition} is covered only from ${ok}. This admission is ${daysBetween(bill.admissionDate, ok)} days too early.`,
          hi: `${w.condition} का कवर ${ok} से है। यह भर्ती ${daysBetween(bill.admissionDate, ok)} दिन पहले है।`,
        },
      });
      if (bill.isPlanned)
        fixes.push({
          when: "before_admission", saves: billTotal,
          title: { en: `If your doctor agrees it is safe, schedule the surgery on or after ${ok}`, hi: `अगर डॉक्टर सुरक्षित मानें, तो सर्जरी ${ok} या उसके बाद कराएँ` },
          detail: { en: "Then the waiting period is over and the claim is not rejected for it.", hi: "तब वेटिंग पीरियड खत्म हो जाएगा और इस वजह से क्लेम रिजेक्ट नहीं होगा।" },
        });
    }
  }

  if (facts.hadConditionBeforePolicy) {
    const declared = policy.declaredConditions.some((c) => matches(bill.diagnosis, c.toLowerCase().split(/[\s,/]+/).filter((w) => w.length > 3)));
    if (!declared) {
      blockers.push({
        code: "ped_not_declared", severity: "high_risk", clauseRef: policy.pedClauseRef,
        title: { en: "Condition existed before the policy but is not declared", hi: "बीमारी पॉलिसी से पहले थी, पर घोषित नहीं की गई" },
        detail: {
          en: "Non-disclosure is the top reason for rejection and can also cancel the policy.",
          hi: "बीमारी न बताना रिजेक्शन का सबसे बड़ा कारण है, और इससे पॉलिसी भी रद्द हो सकती है।",
        },
      });
      fixes.push({
        when: "now", saves: null,
        title: { en: "Talk to your insurer or agent before filing", hi: "क्लेम से पहले बीमा कंपनी या एजेंट से बात करें" },
        detail: { en: "Answer the claim form's medical-history questions truthfully. Hiding it makes things worse.", hi: "क्लेम फॉर्म में पुरानी बीमारी के सवालों का सच जवाब दें। छुपाने से नुकसान बढ़ता है।" },
      });
    } else {
      const ok = addMonths(policy.policyStartDate, policy.pedWaitingMonths);
      if (bill.admissionDate < ok)
        blockers.push({
          code: "ped_waiting", severity: "reject", clauseRef: policy.pedClauseRef,
          title: { en: "Pre-existing disease waiting period", hi: "पहले से मौजूद बीमारी का वेटिंग पीरियड" },
          detail: { en: `Declared pre-existing conditions are covered only from ${ok}.`, hi: `घोषित पुरानी बीमारियाँ ${ok} से कवर होती हैं।` },
        });
    }
  }

  // ---------- fixes ----------
  if (roomExcess + prop > 0) {
    fixes.push({
      when: "before_admission", saves: roomExcess + prop,
      title: { en: `Choose a room up to ${inr(limit!)}/day`, hi: `${inr(limit!)}/दिन तक का कमरा चुनें` },
      detail: {
        en: `The costlier room cost you ${inr(roomExcess)} in rent and ${inr(prop)} more in hidden cuts. If you were moved there because a cheaper room was full, get that in writing. And if the hospital charges the same doctor and nursing fees for every room type, IRDAI rules don't allow the hidden cut — ask for the tariff and challenge it.`,
        hi: `महंगे कमरे से किराये में ${inr(roomExcess)} और छुपी कटौती में ${inr(prop)} का नुकसान। अगर सस्ता कमरा खाली नहीं था, तो लिखित में लें। और अगर अस्पताल हर कमरे के लिए डॉक्टर-नर्सिंग का एक ही रेट लेता है, तो IRDAI नियम से छुपी कटौती नहीं हो सकती — टैरिफ माँगें और आपत्ति करें।`,
      },
    });
  }

  const req = requiredDocs(facts.claimType, bill.isAccident);
  const checklist = req.map((id) => {
    const d = DOCUMENTS.find((x) => x.id === id)!;
    return { id, label: { en: d.en, hi: d.hi }, why: d.why, have: facts.documents.includes(id) };
  });
  const missing = checklist.filter((c) => !c.have);
  if (missing.length)
    fixes.push({
      when: "before_submission", saves: null,
      title: { en: `Collect ${missing.length} missing document${missing.length > 1 ? "s" : ""} before you submit`, hi: `जमा करने से पहले ${missing.length} दस्तावेज़ इकट्ठा करें` },
      detail: { en: missing.map((m) => m.label.en).join(" · "), hi: missing.map((m) => m.label.hi).join(" · ") },
    });

  // ---------- deadlines ----------
  const deadlines: Deadline[] = [];
  const intimDue = bill.isPlanned
    ? addDays(bill.admissionDate, -Math.ceil(policy.intimationHoursPlanned / 24))
    : addDays(bill.admissionDate, Math.ceil(policy.intimationHoursEmergency / 24));
  const intimStatus: Deadline["status"] = facts.intimatedAt
    ? facts.intimatedAt <= intimDue ? "ok" : "late"
    : today > intimDue ? "missed" : "due";
  deadlines.push({
    date: intimDue, status: intimStatus,
    label: bill.isPlanned
      ? { en: `Tell the insurer ${policy.intimationHoursPlanned}h before a planned admission`, hi: `तय भर्ती से ${policy.intimationHoursPlanned} घंटे पहले बीमा कंपनी को बताएँ` }
      : { en: `Tell the insurer within ${policy.intimationHoursEmergency}h of emergency admission`, hi: `इमरजेंसी भर्ती के ${policy.intimationHoursEmergency} घंटे में बीमा कंपनी को बताएँ` },
  });
  if (intimStatus === "due" || intimStatus === "missed")
    fixes.unshift({
      when: "now", saves: null,
      title: { en: "Inform your insurer today", hi: "आज ही बीमा कंपनी को सूचित करें" },
      detail: {
        en: intimStatus === "missed"
          ? "The deadline has passed. Inform them now and write the reason for the delay — late intimation is often condoned with a valid reason."
          : `Call the insurer / TPA helpline or use their app before ${intimDue}. Note the intimation number.`,
        hi: intimStatus === "missed"
          ? "समय सीमा निकल गई है। अभी सूचित करें और देरी का कारण लिखें — उचित कारण हो तो देरी अक्सर माफ होती है।"
          : `${intimDue} से पहले बीमा कंपनी / TPA हेल्पलाइन या ऐप पर सूचना दें। सूचना नंबर नोट करें।`,
      },
    });
  if (facts.claimType === "reimbursement") {
    const due = addDays(bill.dischargeDate, policy.claimSubmissionDays);
    deadlines.push({
      date: due, status: today > due ? "missed" : "due",
      label: { en: `Submit documents within ${policy.claimSubmissionDays} days of discharge`, hi: `डिस्चार्ज के ${policy.claimSubmissionDays} दिन में दस्तावेज़ जमा करें` },
    });
  }

  // ---------- verdict ----------
  const rejected = blockers.some((b) => b.severity === "reject");
  const payable = rejected ? 0 : round(admissible);
  if (rejected)
    deductions.push({
      kind: "rejected", amount: round(admissible), avoidable: false, clauseRef: blockers.find((b) => b.severity === "reject")!.clauseRef,
      title: { en: "Whole claim likely rejected", hi: "पूरा क्लेम रिजेक्ट होने की संभावना" },
      reason: { en: "See the waiting-period warning above.", hi: "ऊपर वेटिंग पीरियड की चेतावनी देखें।" },
    });
  const verdict: Analysis["verdict"] = rejected
    ? "likely_rejected"
    : blockers.length
      ? "high_risk"
      : payable >= billTotal * 0.9
        ? "likely_approved"
        : "partial";

  fixes.sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0));

  return {
    days, roomLimitPerDay: limit, billTotal: round(billTotal), payable, outOfPocket: round(billTotal - payable), verdict,
    lines: lines.map((l) => ({ ...l, payable: round(l.payable), deducted: round(l.deducted) })),
    deductions: deductions.map((d) => ({ ...d, amount: round(d.amount) })).sort((a, b) => b.amount - a.amount),
    blockers, fixes, checklist, deadlines,
  };
}

/** Admission-time advice: what each room choice would cost the patient. */
export function compareRooms(
  policy: Policy,
  base: Bill,
  rooms: { name: string; rentPerDay: number }[],
  facts: PatientFacts,
  today: string,
) {
  return rooms.map((r) => {
    const days = Math.max(1, daysBetween(base.admissionDate, base.dischargeDate));
    const items = base.items.map((i) => (i.category === "room" ? { ...i, amount: r.rentPerDay * days } : i));
    const a = analyze(policy, { ...base, roomType: r.name, roomRentPerDay: r.rentPerDay, items }, facts, today);
    return { ...r, billTotal: a.billTotal, payable: a.payable, outOfPocket: a.outOfPocket };
  });
}
