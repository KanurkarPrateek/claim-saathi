import type { Bill, PatientFacts, Policy } from "./schema";

// Fictional insurer and patients — demo data only.
const basePolicy: Policy = {
  insurer: "Suraksha General Insurance (demo)",
  planName: "Family Health Shield",
  policyStartDate: "2025-09-10",
  sumInsured: 300000,
  roomRent: { kind: "percent_of_si", value: 1, icuValue: 2, clauseRef: "Section 3.1(a)" },
  copayPercent: 0,
  copayClauseRef: "",
  initialWaitingDays: 30,
  initialWaitingClauseRef: "Section 4.1",
  pedWaitingMonths: 36,
  pedClauseRef: "Section 4.2",
  specificWaiting: [
    { condition: "Knee / joint replacement", keywords: ["knee", "arthroplasty", "joint replacement"], months: 24, clauseRef: "Section 4.3(xii)" },
    { condition: "Cataract", keywords: ["cataract"], months: 24, clauseRef: "Section 4.3(i)" },
    { condition: "Hernia", keywords: ["hernia"], months: 24, clauseRef: "Section 4.3(iv)" },
  ],
  subLimits: [{ condition: "Cataract", keywords: ["cataract"], limit: 40000, clauseRef: "Section 3.4" }],
  declaredConditions: ["Type 2 diabetes"],
  intimationHoursEmergency: 24,
  intimationHoursPlanned: 48,
  claimSubmissionDays: 30,
};

export type Sample = {
  id: string;
  title: string;
  blurb: string;
  policy: Policy;
  bill: Bill;
  facts: PatientFacts;
  rooms: { name: string; rentPerDay: number }[];
};

export const SAMPLES: Sample[] = [
  {
    id: "dengue",
    title: "Ramesh · Dengue · single AC room",
    blurb: "A ₹5,000/day room on a 1% room-rent policy triggers the hidden cut.",
    policy: basePolicy,
    bill: {
      patientName: "Ramesh Patil",
      hospitalName: "Sahyadri Care Hospital, Pune",
      admissionDate: "2026-11-08",
      dischargeDate: "2026-11-12",
      diagnosis: "Dengue fever with thrombocytopenia",
      isAccident: false,
      isPlanned: false,
      roomType: "Single AC room",
      roomRentPerDay: 5000,
      items: [
        { description: "Room rent – Single AC (4 days)", category: "room", amount: 20000 },
        { description: "Consultant visits", category: "doctor_fees", amount: 8000 },
        { description: "Nursing charges", category: "nursing", amount: 6000 },
        { description: "CBC / platelet count x8, NS1, IgM", category: "investigations", amount: 12500 },
        { description: "Platelet transfusion (SDP)", category: "other", amount: 9000 },
        { description: "IV fluids and medicines", category: "pharmacy", amount: 14200 },
        { description: "Gloves and masks", category: "consumables", amount: 1450 },
        { description: "Admission kit", category: "consumables", amount: 850 },
        { description: "Registration charges", category: "other", amount: 500 },
        { description: "Attendant food", category: "other", amount: 2400 },
      ],
    },
    facts: {
      claimType: "reimbursement",
      hadConditionBeforePolicy: false,
      intimatedAt: "2026-11-08",
      documents: ["claim_form", "discharge_summary", "payment_receipts", "investigation_reports", "prescriptions", "pharmacy_bills", "id_proof", "policy_copy"],
    },
    rooms: [
      { name: "General ward", rentPerDay: 1500 },
      { name: "Twin sharing", rentPerDay: 2800 },
      { name: "Single AC", rentPerDay: 5000 },
      { name: "Deluxe", rentPerDay: 8000 },
    ],
  },
  {
    id: "knee",
    title: "Sunita · Planned knee replacement",
    blurb: "Surgery booked 14 months into the policy — inside a 24-month waiting period.",
    policy: basePolicy,
    bill: {
      patientName: "Sunita Deshmukh",
      hospitalName: "Lokmanya Ortho Centre, Nashik",
      admissionDate: "2026-12-02",
      dischargeDate: "2026-12-06",
      diagnosis: "Osteoarthritis right knee – total knee arthroplasty",
      isAccident: false,
      isPlanned: true,
      roomType: "Twin sharing",
      roomRentPerDay: 2500,
      items: [
        { description: "Room rent – Twin sharing (4 days)", category: "room", amount: 10000 },
        { description: "Surgeon fees", category: "surgeon_fees", amount: 60000 },
        { description: "Knee implant", category: "implants", amount: 95000 },
        { description: "OT charges", category: "ot_procedure", amount: 30000 },
        { description: "Medicines", category: "pharmacy", amount: 18000 },
        { description: "Pre-op tests and X-ray", category: "investigations", amount: 9000 },
        { description: "Nursing", category: "nursing", amount: 5000 },
      ],
    },
    facts: {
      claimType: "cashless",
      hadConditionBeforePolicy: false,
      intimatedAt: null,
      documents: ["id_proof", "policy_copy", "investigation_reports", "prescriptions"],
    },
    rooms: [
      { name: "General ward", rentPerDay: 1500 },
      { name: "Twin sharing", rentPerDay: 2500 },
      { name: "Single AC", rentPerDay: 4500 },
    ],
  },
  {
    id: "appendix",
    title: "Arjun · Emergency appendicitis",
    blurb: "A clean claim — only small non-medical cuts and one missing form.",
    policy: { ...basePolicy, policyStartDate: "2023-04-01", planName: "Family Health Shield (renewed)" },
    bill: {
      patientName: "Arjun Kulkarni",
      hospitalName: "City Multispeciality Hospital, Mumbai",
      admissionDate: "2026-11-13",
      dischargeDate: "2026-11-15",
      diagnosis: "Acute appendicitis – laparoscopic appendectomy",
      isAccident: false,
      isPlanned: false,
      roomType: "General ward",
      roomRentPerDay: 1800,
      items: [
        { description: "Room rent – General ward (2 days)", category: "room", amount: 3600 },
        { description: "Surgeon fees", category: "surgeon_fees", amount: 35000 },
        { description: "OT charges", category: "ot_procedure", amount: 18000 },
        { description: "Anaesthetist fees", category: "doctor_fees", amount: 8000 },
        { description: "Medicines", category: "pharmacy", amount: 9500 },
        { description: "Blood tests and ultrasound", category: "investigations", amount: 6200 },
        { description: "Nursing", category: "nursing", amount: 2400 },
        { description: "Sutures, drapes, trocar", category: "consumables", amount: 4300 },
        { description: "Registration charges", category: "other", amount: 500 },
        { description: "Documentation charges", category: "other", amount: 300 },
      ],
    },
    facts: {
      claimType: "cashless",
      hadConditionBeforePolicy: false,
      intimatedAt: "2026-11-13",
      documents: ["preauth_form", "discharge_summary", "itemised_bill", "investigation_reports", "prescriptions", "id_proof", "policy_copy"],
    },
    rooms: [
      { name: "General ward", rentPerDay: 1800 },
      { name: "Twin sharing", rentPerDay: 3000 },
      { name: "Single AC", rentPerDay: 5500 },
    ],
  },
];
