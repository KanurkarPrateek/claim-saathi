"use client";
import type { Lang } from "./ui";

/** Everything a scene may change. Provided by App. */
export type TourCtx = {
  reset: () => void; // empty app on the home screen, English
  startFlow: (f: "admission" | "discharge") => void;
  samplePolicy: (id: string) => void;
  sampleBill: (id: string) => void;
  goStep: (s: "home" | "policy" | "bill" | "questions" | "result") => void;
  loadSample: (id: string) => void;
  showPack: (on: boolean) => void;
  setLang: (l: Lang) => void;
};

export type Scene = {
  ms: number;
  spot?: string; // data-demo target to scroll to and highlight
  en: string;
  hi: string;
  run: (c: TourCtx) => void;
};

export const SCENES: Scene[] = [
  {
    ms: 5000,
    en: "Meet Ramesh. He's leaving hospital after dengue. Will his insurance pay — and how much?",
    hi: "मिलिए रमेश से। डेंगू के बाद अस्पताल से छुट्टी हो रही है। बीमा कितना देगा?",
    run: (c) => c.reset(),
  },
  {
    ms: 3500,
    spot: "upload",
    en: "Step 1 — he takes a photo of his policy.",
    hi: "स्टेप 1 — वह अपनी पॉलिसी की फोटो लेता है।",
    run: (c) => c.startFlow("discharge"),
  },
  {
    ms: 5500,
    spot: "policy-summary",
    en: "AI reads it: room limit ₹3,000/day, waiting periods, and the clause behind each rule.",
    hi: "AI पढ़ता है: कमरे की सीमा ₹3,000/दिन, वेटिंग पीरियड, और हर नियम का क्लॉज़।",
    run: (c) => c.samplePolicy("dengue"),
  },
  {
    ms: 3500,
    spot: "upload",
    en: "Step 2 — a photo of the hospital bill.",
    hi: "स्टेप 2 — अस्पताल के बिल की फोटो।",
    run: (c) => c.goStep("bill"),
  },
  {
    ms: 5000,
    spot: "bill-summary",
    en: "Every line is read and sorted — ₹74,900 in 10 items.",
    hi: "हर लाइन पढ़ी और छाँटी गई — 10 आइटम, ₹74,900।",
    run: (c) => c.sampleBill("dengue"),
  },
  {
    ms: 5000,
    spot: "questions",
    en: "Step 3 — three taps only he can answer. No forms.",
    hi: "स्टेप 3 — तीन टैप, जो सिर्फ वही जानता है। कोई फॉर्म नहीं।",
    run: (c) => c.goStep("questions"),
  },
  {
    ms: 6000,
    spot: "verdict",
    en: "He'll get ₹52,500 of ₹74,900 — and ₹17,200 of the cut was avoidable.",
    hi: "₹74,900 में से ₹52,500 मिलेंगे — और ₹17,200 की कटौती टाली जा सकती थी।",
    run: (c) => c.goStep("result"),
  },
  {
    ms: 7000,
    spot: "deductions",
    en: "The hidden cut: his room was above the limit, so doctor, nursing and procedure charges were also paid at only 60%.",
    hi: "छुपी कटौती: कमरा सीमा से ऊपर था, इसलिए डॉक्टर, नर्सिंग और प्रोसीजर का भी सिर्फ 60% मिला।",
    run: () => {},
  },
  {
    ms: 5500,
    spot: "fixes",
    en: "What to do next, ranked by rupees saved — with the policy clause for every cut.",
    hi: "आगे क्या करें — बचत के हिसाब से क्रम में, हर कटौती का क्लॉज़ साथ।",
    run: () => {},
  },
  {
    ms: 5000,
    spot: "pack",
    en: "One tap: a ready claim pack — cover letter, checklist, and a grievance letter if the insurer cuts more.",
    hi: "एक टैप: तैयार क्लेम पैक — कवर लेटर, चेकलिस्ट, और ज़्यादा कटने पर शिकायत पत्र।",
    run: (c) => c.showPack(true),
  },
  {
    ms: 6500,
    spot: "blockers",
    en: "Now Sunita. Her knee surgery is booked 14 months into her policy — it would be rejected.",
    hi: "अब सुनीता। घुटने की सर्जरी पॉलिसी के 14 महीने में तय है — क्लेम रिजेक्ट हो जाता।",
    run: (c) => c.loadSample("knee"),
  },
  {
    ms: 6500,
    spot: "rooms",
    en: "Claim Saathi tells her the date she's covered, and which room costs her ₹0 — before she's admitted.",
    hi: "क्लेम साथी बताता है कब से कवर है, और कौन-सा कमरा ₹0 का पड़ेगा — भर्ती से पहले।",
    run: () => {},
  },
  {
    ms: 5000,
    spot: "blockers",
    en: "In Hindi too.",
    hi: "हिन्दी में भी।",
    run: (c) => c.setLang("hi"),
  },
  {
    ms: 0, // end card waits for the viewer
    en: "Claim Saathi — fix your health claim before it fails.",
    hi: "क्लेम साथी — क्लेम फेल होने से पहले ही ठीक करें।",
    run: (c) => {
      c.setLang("en");
      c.reset();
    },
  },
];

export function DemoBar({
  scene,
  paused,
  lang,
  onPrev,
  onNext,
  onToggle,
  onExit,
  onReplay,
}: {
  scene: number;
  paused: boolean;
  lang: Lang;
  onPrev: () => void;
  onNext: () => void;
  onToggle: () => void;
  onExit: () => void;
  onReplay: () => void;
}) {
  const s = SCENES[scene];
  const last = scene === SCENES.length - 1;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 pb-[env(safe-area-inset-bottom)] print:hidden">
      <div className="mx-auto max-w-lg px-3 pb-3">
        <div className="rounded-3xl bg-slate-900/95 p-4 text-white shadow-2xl backdrop-blur">
          <div className="mb-3 flex gap-1" aria-hidden>
            {SCENES.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < scene ? "bg-sky-400" : i === scene ? "bg-white" : "bg-white/20"}`} />
            ))}
          </div>
          <p key={scene} className="min-h-[3.5rem] animate-[fadein_.4s_ease] text-[17px] font-medium leading-snug" aria-live="polite">
            {lang === "hi" ? s.hi : s.en}
          </p>
          {last ? (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onReplay} className="h-11 flex-1 rounded-2xl bg-white/10 font-semibold active:bg-white/20">
                ↺ {lang === "hi" ? "फिर देखें" : "Replay"}
              </button>
              <button type="button" onClick={onExit} className="h-11 flex-1 rounded-2xl bg-sky-500 font-semibold text-white active:bg-sky-600">
                {lang === "hi" ? "खुद आज़माएँ" : "Try it yourself"}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={onPrev} disabled={scene === 0} aria-label="Previous" className="h-11 w-11 rounded-full bg-white/10 text-lg disabled:opacity-30">
                ‹
              </button>
              <button type="button" onClick={onToggle} aria-label={paused ? "Play" : "Pause"} className="h-11 w-11 rounded-full bg-white text-lg text-slate-900">
                {paused ? "▶" : "❚❚"}
              </button>
              <button type="button" onClick={onNext} aria-label="Next" className="h-11 w-11 rounded-full bg-white/10 text-lg">
                ›
              </button>
              <span className="flex-1 text-right text-xs text-white/60">
                {scene + 1} / {SCENES.length}
              </span>
              <button type="button" onClick={onExit} className="h-11 rounded-full px-4 text-sm font-medium text-white/80 active:bg-white/10">
                {lang === "hi" ? "बंद करें" : "Exit"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
