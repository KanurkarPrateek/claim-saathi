import { Suspense } from "react";
import { connection } from "next/server";
import App from "@/components/App";

async function WithToday({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  await connection();
  // Deadlines are judged in Indian time.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const { demo } = await searchParams;
  return <App today={today} demo={demo} />;
}

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-sm text-slate-500">Loading Claim Saathi…</div>}>
      <WithToday searchParams={searchParams as Promise<{ demo?: string }>} />
    </Suspense>
  );
}
