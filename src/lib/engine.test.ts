import { describe, expect, it } from "vitest";
import { analyze, compareRooms } from "./engine";
import { SAMPLES } from "./samples";

const TODAY = "2026-11-15";
const get = (id: string) => SAMPLES.find((s) => s.id === id)!;

describe("dengue – costly room", () => {
  const s = get("dengue");
  const a = analyze(s.policy, s.bill, s.facts, TODAY);

  it("totals the bill", () => expect(a.billTotal).toBe(74900));
  it("uses 1% of SI as room limit", () => expect(a.roomLimitPerDay).toBe(3000));
  it("caps room rent", () => expect(a.deductions.find((d) => d.kind === "room_excess")!.amount).toBe(8000));
  it("applies proportionate deduction at 60% to associated charges only", () => {
    // (doctor 8000 + nursing 6000 + transfusion 9000) * 0.4 — tests, pharmacy, ICU exempt per IRDAI 2020 circular
    expect(a.deductions.find((d) => d.kind === "proportionate")!.amount).toBe(9200);
    expect(a.lines.find((l) => l.item.category === "pharmacy")!.deducted).toBe(0);
    expect(a.lines.find((l) => l.item.category === "investigations")!.deducted).toBe(0);
  });
  it("cuts non-payable items fully", () => expect(a.deductions.find((d) => d.kind === "non_payable")!.amount).toBe(5200));
  it("computes payout", () => {
    expect(a.payable).toBe(52500);
    expect(a.outOfPocket).toBe(22400);
    expect(a.verdict).toBe("partial");
  });
  it("top fix is the room, worth 17,200", () => expect(a.fixes[0].saves).toBe(17200));
  it("flags missing itemised bill and cheque", () => {
    const missing = a.checklist.filter((c) => !c.have).map((c) => c.id);
    expect(missing).toEqual(["itemised_bill", "cancelled_cheque"]);
  });
});

describe("knee – specific waiting period", () => {
  const s = get("knee");
  const a = analyze(s.policy, s.bill, s.facts, TODAY);
  it("rejects", () => {
    expect(a.verdict).toBe("likely_rejected");
    expect(a.payable).toBe(0);
    expect(a.blockers[0].code).toBe("specific_waiting");
  });
  it("suggests the safe date", () => expect(a.fixes.some((f) => f.title.en.includes("2027-09-10"))).toBe(true));
  it("planned intimation is due 2 days before admission", () => {
    expect(a.deadlines[0]).toMatchObject({ date: "2026-11-30", status: "due" });
  });
});

describe("appendix – clean claim", () => {
  const s = get("appendix");
  const a = analyze(s.policy, s.bill, s.facts, TODAY);
  it("approves nearly all", () => {
    expect(a.payable).toBe(87000);
    expect(a.verdict).toBe("likely_approved");
  });
});

describe("rules", () => {
  const s = get("dengue");
  it("undeclared pre-existing condition is high risk", () => {
    const a = analyze(s.policy, s.bill, { ...s.facts, hadConditionBeforePolicy: true }, TODAY);
    expect(a.verdict).toBe("high_risk");
  });
  it("initial 30-day waiting rejects non-accident claims", () => {
    const a = analyze({ ...s.policy, policyStartDate: "2026-10-20" }, s.bill, s.facts, TODAY);
    expect(a.verdict).toBe("likely_rejected");
  });
  it("accidents skip the initial waiting period", () => {
    const a = analyze({ ...s.policy, policyStartDate: "2026-10-20" }, { ...s.bill, isAccident: true }, s.facts, TODAY);
    expect(a.blockers.find((b) => b.code === "initial_waiting")).toBeUndefined();
  });
  it("applies co-pay after other cuts", () => {
    const a = analyze({ ...s.policy, copayPercent: 10 }, s.bill, s.facts, TODAY);
    expect(a.payable).toBe(47250);
  });
  it("room comparison: general ward has lowest out of pocket", () => {
    const r = compareRooms(s.policy, s.bill, s.rooms, s.facts, TODAY);
    const ward = r.find((x) => x.name === "General ward")!;
    expect(ward.outOfPocket).toBe(5200); // only non-payables
  });
});
