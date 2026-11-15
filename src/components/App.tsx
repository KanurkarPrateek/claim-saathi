"use client";
import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { analyze, compareRooms } from "@/lib/engine";
import { SAMPLES, type Sample } from "@/lib/samples";
import type { Bill, Docs, PatientFacts, Policy } from "@/lib/schema";
import { anyMissing, BillEditor, BillSummary, MissingBillFields, MissingPolicyFields, missingBill, missingPolicy, PolicyEditor, PolicySummary, Upload } from "./Inputs";
import { DOCUMENTS } from "@/lib/rules";
import { Blockers, Checklist, Deadlines, Deductions, Fixes, RoomCompare, Verdict } from "./Results";
import { ClaimPack } from "./ClaimPack";
import { DemoBar, SCENES, type TourCtx } from "./DemoTour";
import { inputCls, type Lang } from "./ui";

type Flow = "admission" | "discharge";
type Step = "home" | "policy" | "bill" | "plan" | "questions" | "result";
type Plan = { diagnosis: string; admissionDate: string; days: number; isPlanned: boolean; estimate: number };
type Room = { name: string; rentPerDay: number };

const STEPS: Record<Flow, Step[]> = {
  discharge: ["policy", "bill", "questions", "result"],
  admission: ["policy", "plan", "questions", "result"],
};

const DEFAULT_ROOMS: Room[] = [
  { name: "General ward", rentPerDay: 1500 },
  { name: "Twin sharing", rentPerDay: 3000 },
  { name: "Single room", rentPerDay: 5000 },
];

const DEFAULT_FACTS: PatientFacts = { claimType: "cashless", hadConditionBeforePolicy: false, intimatedAt: null, documents: [] };

const addDays = (s: string, n: number) => new Date(new Date(s + "T00:00:00Z").getTime() + n * 86_400_000).toISOString().slice(0, 10);
const nights = (a: string, b: string) => Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000));

function planFromBill(b: Bill): Plan {
  return {
    diagnosis: b.diagnosis,
    admissionDate: b.admissionDate,
    days: nights(b.admissionDate, b.dischargeDate),
    isPlanned: b.isPlanned,
    estimate: b.items.filter((i) => i.category !== "room").reduce((s, i) => s + i.amount, 0),
  };
}

/** For "before admission" there is no bill yet: build an estimated one from the plan. */
function billFromPlan(p: Plan, room: Room): Bill {
  return {
    patientName: "Patient",
    hospitalName: "",
    admissionDate: p.admissionDate,
    dischargeDate: addDays(p.admissionDate, p.days),
    diagnosis: p.diagnosis,
    isAccident: false,
    isPlanned: p.isPlanned,
    roomType: room.name,
    roomRentPerDay: room.rentPerDay,
    items: [
      { description: `Room rent (${p.days} days)`, category: "room", amount: room.rentPerDay * p.days },
      { description: "Doctor, nursing, tests, OT (estimate)", category: "other", amount: Math.round(p.estimate * 0.6) },
      { description: "Medicines and consumables (estimate)", category: "pharmacy", amount: Math.round(p.estimate * 0.4) },
    ],
  };
}

export default function App({ today, demo }: { today: string; demo?: string }) {
  const sample = SAMPLES.find((x) => x.id === demo);
  const [lang, setLang] = useState<Lang>("en");
  const [flow, setFlow] = useState<Flow>(sample?.bill.isPlanned ? "admission" : "discharge");
  const [step, setStep] = useState<Step>(sample ? "result" : "home");
  const [policy, setPolicy] = useState<Policy | null>(sample?.policy ?? null);
  const [bill, setBill] = useState<Bill | null>(sample?.bill ?? null);
  const [plan, setPlan] = useState<Plan>(() =>
    sample ? planFromBill(sample.bill) : { diagnosis: "", admissionDate: addDays(today, 7), days: 3, isPlanned: true, estimate: 60000 },
  );
  const [rooms, setRooms] = useState<Room[]>(sample?.rooms ?? DEFAULT_ROOMS);
  const [facts, setFacts] = useState<PatientFacts>(sample?.facts ?? DEFAULT_FACTS);
  const [showPack, setShowPack] = useState(false);
  const [scanned, setScanned] = useState<Docs["documents"]>([]);
  const [tour, setTour] = useState<number | null>(demo === "tour" ? 0 : null);
  const [paused, setPaused] = useState(false);
  const [spot, setSpot] = useState<string | null>(null);
  const hi = lang === "hi";

  const effectiveBill = useMemo(() => (flow === "admission" ? billFromPlan(plan, rooms[rooms.length - 1] ?? DEFAULT_ROOMS[0]) : bill), [flow, plan, rooms, bill]);
  const a = useMemo(() => (policy && effectiveBill ? analyze(policy, effectiveBill, facts, today) : null), [policy, effectiveBill, facts, today]);
  // Room costs assume the claim is covered, so a waiting-period rejection doesn't flatten the comparison.
  const roomRows = useMemo(() => {
    if (!policy || !effectiveBill) return [];
    const covered = { ...policy, specificWaiting: [], initialWaitingDays: 0 };
    return compareRooms(covered, effectiveBill, rooms, { ...facts, hadConditionBeforePolicy: false }, today);
  }, [policy, effectiveBill, rooms, facts, today]);

  const steps = STEPS[flow];
  const idx = steps.indexOf(step);
  const go = (s: Step) => {
    setStep(s);
    setShowPack(false);
    window.scrollTo({ top: 0 });
  };
  const next = () => go(steps[idx + 1]);
  const back = () => (idx <= 0 ? go("home") : go(steps[idx - 1]));

  function start(f: Flow) {
    setFlow(f);
    setFacts({ ...DEFAULT_FACTS, claimType: f === "admission" ? "cashless" : "reimbursement" });
    go("policy");
  }

  function loadSample(s: Sample) {
    const f: Flow = s.bill.isPlanned ? "admission" : "discharge";
    setFlow(f);
    setPolicy(s.policy);
    setBill(s.bill);
    setPlan(planFromBill(s.bill));
    setRooms(s.rooms);
    setFacts(s.facts);
    go("result");
  }

  // ---------- guided demo ----------
  const sampleById = (id: string) => SAMPLES.find((x) => x.id === id)!;
  const tourCtx: TourCtx = {
    reset: () => {
      setFlow("discharge");
      setPolicy(null);
      setBill(null);
      setFacts(DEFAULT_FACTS);
      setScanned([]);
      setRooms(DEFAULT_ROOMS);
      go("home");
    },
    startFlow: (f) => start(f),
    samplePolicy: (id) => setPolicy(sampleById(id).policy),
    sampleBill: (id) => {
      const x = sampleById(id);
      setBill(x.bill);
      setFacts(x.facts);
    },
    goStep: (s) => go(s),
    loadSample: (id) => loadSample(sampleById(id)),
    showPack: (on) => setShowPack(on),
    setLang,
  };
  function playScene(i: number) {
    const sc = SCENES[i];
    setTour(i);
    sc.run(tourCtx);
    setSpot(sc.spot ?? null);
    // Put the highlighted card just under the header, clear of the caption bar at the bottom.
    if (sc.spot)
      setTimeout(() => {
        const el = document.querySelector(`[data-demo="${sc.spot}"]`);
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: "smooth" });
      }, 400);
  }
  const advance = useEffectEvent(() => {
    if (tour !== null && tour < SCENES.length - 1) playScene(tour + 1);
  });
  useEffect(() => {
    if (tour === null || paused || SCENES[tour].ms === 0) return;
    const t = setTimeout(advance, SCENES[tour].ms);
    return () => clearTimeout(t);
  }, [tour, paused]);
  function exitTour() {
    setTour(null);
    setSpot(null);
    setPaused(false);
    setLang("en");
    tourCtx.reset();
  }
  const spotCls = (n: string) => (spot === n ? "rounded-3xl ring-4 ring-sky-400 ring-offset-4 ring-offset-slate-50 transition" : "transition");

  const canNext =
    step === "policy" ? !!policy && !anyMissing(missingPolicy(policy)) : step === "bill" ? !!bill && !anyMissing(missingBill(bill)) : step === "plan" ? plan.diagnosis.trim() !== "" && rooms.length > 0 : true;

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      {/* top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-4">
          {step !== "home" ? (
            <button type="button" onClick={back} aria-label={hi ? "पीछे" : "Back"} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-slate-700 active:bg-slate-100">
              ←
            </button>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 font-bold text-white">स</div>
          )}
          <div className="flex-1">
            <p className="font-bold leading-tight">Claim Saathi</p>
            {step !== "home" && (
              <div className="mt-1 flex gap-1" aria-label={`Step ${idx + 1} of ${steps.length}`}>
                {steps.map((s, i) => (
                  <span key={s} className={`h-1 flex-1 rounded-full ${i <= idx ? "bg-sky-600" : "bg-slate-200"}`} />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLang(hi ? "en" : "hi")}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-100"
          >
            {hi ? "English" : "हिन्दी"}
          </button>
        </div>
      </header>

      <main className={`mx-auto max-w-lg px-4 pt-5 ${tour !== null ? "pb-64" : "pb-32"}`}>
        {step === "home" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-slate-900">
                {hi ? "बीमा कितना देगा? पहले से जानिए।" : "Will your insurance pay? Know before you file."}
              </h1>
              <p className="mt-2 text-slate-600">
                {hi
                  ? "पॉलिसी और बिल की फोटो डालें। हम बताएँगे कितना मिलेगा, क्या कटेगा, और कैसे बचाएँ।"
                  : "Add a photo of your policy and bill. See what will be paid, what will be cut, and how to avoid it."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPaused(false);
                playScene(0);
              }}
              className="flex w-full items-center gap-3 rounded-3xl bg-slate-900 p-4 text-left text-white shadow-lg active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xl text-slate-900" aria-hidden>
                ▶
              </span>
              <span>
                <span className="block text-lg font-semibold">{hi ? "1 मिनट का डेमो देखें" : "Watch the 1-minute demo"}</span>
                <span className="block text-sm text-white/70">{hi ? "दो असली कहानियाँ, अपने-आप चलेंगी" : "Two real stories, plays by itself"}</span>
              </span>
            </button>
            <div className="space-y-3">
              <BigChoice
                icon="🏥"
                title={hi ? "भर्ती होने वाले हैं" : "Getting admitted soon"}
                sub={hi ? "सही कमरा चुनें, वेटिंग पीरियड जाँचें" : "Pick the right room, check waiting periods"}
                onClick={() => start("admission")}
              />
              <BigChoice
                icon="🧾"
                title={hi ? "डिस्चार्ज हो रहे हैं / हो गए" : "Being discharged / already home"}
                sub={hi ? "कितना मिलेगा और क्यों, दस्तावेज़" : "What will be paid, why, and documents"}
                onClick={() => start("discharge")}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{hi ? "उदाहरण देखें" : "See an example"}</p>
              <div className="space-y-2">
                {SAMPLES.map((s) => (
                  <button key={s.id} type="button" onClick={() => loadSample(s)} className="w-full rounded-2xl bg-white p-3.5 text-left ring-1 ring-slate-200 active:bg-slate-50">
                    <p className="font-medium text-slate-900">{s.title}</p>
                    <p className="text-sm text-slate-500">{s.blurb}</p>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-center text-xs text-slate-400">{hi ? "अनुमान है; अंतिम निर्णय बीमा कंपनी का।" : "Estimates only — the insurer makes the final decision."}</p>
          </div>
        )}

        {step === "policy" && (
          <StepShell title={hi ? "आपकी पॉलिसी" : "Your policy"} sub={hi ? "हम कमरे की सीमा, वेटिंग पीरियड और नियम पढ़ेंगे।" : "We read the room limit, waiting periods and rules."}>
            <div data-demo="upload" className={spotCls("upload")}>
              <Upload kind="policy" lang={lang} done={!!policy} onData={(d) => setPolicy(d as Policy)} />
            </div>
            {policy && (
              <>
                <MissingPolicyFields key={policy.planName + policy.insurer} policy={policy} setPolicy={setPolicy} lang={lang} />
                <div data-demo="policy-summary" className={spotCls("policy-summary")}>
                  <PolicySummary policy={policy} lang={lang} />
                </div>
                <EditDetails lang={lang}>
                  <PolicyEditor policy={policy} setPolicy={setPolicy} />
                </EditDetails>
              </>
            )}
          </StepShell>
        )}

        {step === "bill" && (
          <StepShell title={hi ? "अस्पताल का बिल" : "Hospital bill"} sub={hi ? "फाइनल बिल की साफ फोटो लें — सभी पन्ने।" : "Take clear photos of the final bill — all pages."}>
            <div data-demo="upload" className={spotCls("upload")}>
              <Upload kind="bill" lang={lang} done={!!bill} onData={(d) => setBill(d as Bill)} />
            </div>
            {bill && (
              <>
                <MissingBillFields key={bill.hospitalName + bill.items.length} bill={bill} setBill={setBill} lang={lang} />
                <div data-demo="bill-summary" className={spotCls("bill-summary")}>
                  <BillSummary bill={bill} lang={lang} />
                </div>
                <EditDetails lang={lang}>
                  <BillEditor bill={bill} setBill={setBill} />
                </EditDetails>
              </>
            )}
          </StepShell>
        )}

        {step === "plan" && (
          <StepShell title={hi ? "इलाज और कमरे" : "Treatment and rooms"} sub={hi ? "अस्पताल के एस्टिमेट से भरें, या उसकी फोटो डालें।" : "Fill from the hospital's estimate, or add a photo of it."}>
            <Upload
              kind="bill"
              lang={lang}
              done={false}
              onData={(d) => {
                const b = d as Bill;
                setPlan(planFromBill({ ...b, isPlanned: true }));
                if (b.roomRentPerDay && !rooms.some((r) => r.rentPerDay === b.roomRentPerDay))
                  setRooms([...rooms, { name: b.roomType || "Estimate room", rentPerDay: b.roomRentPerDay }]);
              }}
            />
            <div className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{hi ? "इलाज / बीमारी" : "Treatment / illness"}</span>
                <input className={inputCls} placeholder={hi ? "जैसे: घुटने का ऑपरेशन" : "e.g. Knee replacement"} value={plan.diagnosis} onChange={(e) => setPlan({ ...plan, diagnosis: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">{hi ? "भर्ती की तारीख" : "Admission date"}</span>
                  <input className={inputCls} type="date" value={plan.admissionDate} onChange={(e) => setPlan({ ...plan, admissionDate: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">{hi ? "कितने दिन" : "Days"}</span>
                  <input className={inputCls} type="number" inputMode="numeric" min={1} value={plan.days} onChange={(e) => setPlan({ ...plan, days: Math.max(1, +e.target.value) })} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{hi ? "कमरे के अलावा अनुमानित खर्च (₹)" : "Estimated cost apart from room (₹)"}</span>
                <input className={inputCls} type="number" inputMode="numeric" value={plan.estimate} onChange={(e) => setPlan({ ...plan, estimate: +e.target.value })} />
              </label>
            </div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="mb-2 text-sm font-medium text-slate-700">{hi ? "अस्पताल के कमरे और किराया/दिन" : "Hospital rooms and rent per day"}</p>
              <div className="space-y-2">
                {rooms.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={inputCls} value={r.name} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Room name" />
                    <input
                      className={`${inputCls} w-28 text-right`}
                      type="number"
                      inputMode="numeric"
                      value={r.rentPerDay}
                      onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, rentPerDay: +e.target.value } : x)))}
                      aria-label="Rent per day"
                    />
                    <button type="button" aria-label="Remove room" className="px-1 text-slate-400" onClick={() => setRooms(rooms.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-2 text-sm font-medium text-sky-700" onClick={() => setRooms([...rooms, { name: hi ? "नया कमरा" : "Another room", rentPerDay: 4000 }])}>
                + {hi ? "कमरा जोड़ें" : "Add room"}
              </button>
            </div>
            {!policy && <p className="text-sm text-rose-600">{hi ? "पहले पॉलिसी जोड़ें।" : "Add your policy first."}</p>}
          </StepShell>
        )}

        {step === "questions" && (
          <StepShell title={hi ? "3 छोटे सवाल" : "3 quick questions"} sub={hi ? "ये सिर्फ आप जानते हैं।" : "Only you know these."}>
            <div data-demo="questions" className={`space-y-4 ${spotCls("questions")}`}>
            <Question q={hi ? "अस्पताल का बिल कौन भरेगा?" : "Who pays the hospital?"}>
              <Chip on={facts.claimType === "cashless"} onClick={() => setFacts({ ...facts, claimType: "cashless" })}>
                {hi ? "बीमा कंपनी सीधे (कैशलेस)" : "Insurer pays directly (cashless)"}
              </Chip>
              <Chip on={facts.claimType === "reimbursement"} onClick={() => setFacts({ ...facts, claimType: "reimbursement" })}>
                {hi ? "मैं भरूँगा, बाद में क्लेम" : "I pay, then claim back"}
              </Chip>
            </Question>
            <Question q={hi ? "क्या यह बीमारी (या इसके लक्षण/इलाज) पॉलिसी लेने से पहले थी?" : "Did you have this illness (or its symptoms / treatment) before buying the policy?"}>
              <Chip on={!facts.hadConditionBeforePolicy} onClick={() => setFacts({ ...facts, hadConditionBeforePolicy: false })}>
                {hi ? "नहीं" : "No"}
              </Chip>
              <Chip on={facts.hadConditionBeforePolicy} onClick={() => setFacts({ ...facts, hadConditionBeforePolicy: true })}>
                {hi ? "हाँ" : "Yes"}
              </Chip>
            </Question>
            <Question q={hi ? "क्या बीमा कंपनी को बता दिया है?" : "Have you told the insurer yet?"}>
              <Chip on={facts.intimatedAt === null} onClick={() => setFacts({ ...facts, intimatedAt: null })}>
                {hi ? "अभी नहीं" : "Not yet"}
              </Chip>
              <Chip on={facts.intimatedAt !== null} onClick={() => setFacts({ ...facts, intimatedAt: facts.intimatedAt ?? today })}>
                {hi ? "हाँ" : "Yes"}
              </Chip>
              {facts.intimatedAt !== null && (
                <label className="col-span-2 block">
                  <span className="mb-1 block text-xs text-slate-500">{hi ? "किस तारीख को?" : "On which date?"}</span>
                  <input className={inputCls} type="date" value={facts.intimatedAt} onChange={(e) => setFacts({ ...facts, intimatedAt: e.target.value || today })} />
                </label>
              )}
            </Question>
            </div>
          </StepShell>
        )}

        {step === "result" && a && effectiveBill && policy && (
          <div className="space-y-4">
            {showPack ? (
              <div data-demo="pack" className={spotCls("pack")}>
                <ClaimPack a={a} policy={policy} bill={effectiveBill} facts={facts} today={today} />
              </div>
            ) : flow === "admission" ? (
              <>
                <h1 className="text-2xl font-bold">{hi ? "भर्ती से पहले" : "Before you're admitted"}</h1>
                <div data-demo="blockers" className={spotCls("blockers")}>
                  <Blockers a={a} lang={lang} />
                </div>
                {a.blockers.length > 0 && (
                  <p className="px-1 text-sm text-slate-600">
                    {hi ? "नीचे के खर्च यह मानकर हैं कि क्लेम कवर है (वेटिंग पीरियड के बाद)।" : "Room costs below assume the claim is covered (after the waiting period)."}
                  </p>
                )}
                <div data-demo="rooms" className={spotCls("rooms")}>
                  <RoomCompare rows={roomRows} current={-1} limit={a.roomLimitPerDay} lang={lang} />
                </div>
                <Fixes fixes={a.fixes.filter((f) => f.when !== "before_submission")} lang={lang} />
                <Deadlines a={a} lang={lang} />
              </>
            ) : (
              <>
                <div data-demo="verdict" className={spotCls("verdict")}>
                  <Verdict a={a} lang={lang} />
                </div>
                <Blockers a={a} lang={lang} />
                <div data-demo="fixes" className={spotCls("fixes")}>
                  <Fixes fixes={a.fixes} lang={lang} />
                </div>
                <div data-demo="deductions" className={spotCls("deductions")}>
                  <Deductions a={a} lang={lang} />
                </div>
                <Upload
                  kind="docs"
                  lang={lang}
                  compact
                  done={scanned.length > 0}
                  onData={(d) => {
                    const found = (d as Docs).documents;
                    setScanned((prev) => [...prev, ...found]);
                    const ids = found.map((x) => x.type).filter((t) => t !== "other");
                    setFacts((f) => ({ ...f, documents: [...new Set([...f.documents, ...ids])] }));
                  }}
                />
                {scanned.length > 0 && (
                  <ul className="space-y-1 rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200">
                    {scanned.map((x, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-600">✓</span>
                        <span>
                          <b className="font-medium">{DOCUMENTS.find((d) => d.id === x.type)?.[lang] ?? (hi ? "अन्य" : "Other")}</b>
                          <span className="text-slate-500"> — {x.summary}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Checklist
                  a={a}
                  lang={lang}
                  onToggle={(id) =>
                    setFacts({ ...facts, documents: facts.documents.includes(id) ? facts.documents.filter((d) => d !== id) : [...facts.documents, id] })
                  }
                />
                <Deadlines a={a} lang={lang} />
              </>
            )}
          </div>
        )}
      </main>

      {tour !== null && (
        <DemoBar
          scene={tour}
          paused={paused}
          lang={lang}
          onPrev={() => playScene(Math.max(0, tour - 1))}
          onNext={() => playScene(Math.min(SCENES.length - 1, tour + 1))}
          onToggle={() => setPaused(!paused)}
          onExit={exitTour}
          onReplay={() => {
            setPaused(false);
            playScene(0);
          }}
        />
      )}

      {/* bottom action bar */}
      {tour === null && step !== "home" && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur print:hidden">
          <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">
            {step === "result" ? (
              flow === "discharge" ? (
                <>
                  <button type="button" onClick={() => setShowPack(!showPack)} className="h-12 flex-1 rounded-2xl bg-sky-700 text-base font-semibold text-white active:bg-sky-800">
                    {showPack ? (hi ? "नतीजे पर वापस" : "Back to result") : hi ? "क्लेम पैक बनाएँ" : "Get claim pack"}
                  </button>
                  {showPack && (
                    <button type="button" onClick={() => window.print()} className="h-12 rounded-2xl px-4 text-base font-semibold text-sky-800 ring-1 ring-sky-200 active:bg-sky-50">
                      {hi ? "PDF" : "Save PDF"}
                    </button>
                  )}
                </>
              ) : (
                <button type="button" onClick={() => go("home")} className="h-12 flex-1 rounded-2xl bg-sky-700 text-base font-semibold text-white active:bg-sky-800">
                  {hi ? "हो गया" : "Done"}
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={!canNext || (step === "plan" && !policy)}
                onClick={next}
                className="h-12 flex-1 rounded-2xl bg-sky-700 text-base font-semibold text-white active:bg-sky-800 disabled:bg-slate-300"
              >
                {step === "questions" ? (hi ? "नतीजा देखें" : "See my result") : hi ? "आगे" : "Next"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BigChoice({ icon, title, sub, onClick }: { icon: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 active:scale-[0.99] active:bg-sky-50">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-3xl" aria-hidden>
        {icon}
      </span>
      <span className="flex-1">
        <span className="block text-lg font-semibold text-slate-900">{title}</span>
        <span className="block text-sm text-slate-500">{sub}</span>
      </span>
      <span className="text-2xl text-slate-300" aria-hidden>
        ›
      </span>
    </button>
  );
}

function StepShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-slate-600">{sub}</p>
      </div>
      {children}
    </div>
  );
}

function EditDetails({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <details className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <summary className="cursor-pointer text-sm font-medium text-sky-700">{lang === "hi" ? "कुछ गलत है? बदलें" : "Something wrong? Edit details"}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function Question({ q, children }: { q: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <legend className="sr-only">{q}</legend>
      <p className="mb-3 font-medium text-slate-900">{q}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-12 rounded-xl px-3 py-2 text-sm font-medium transition ${on ? "bg-sky-700 text-white" : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 active:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}
