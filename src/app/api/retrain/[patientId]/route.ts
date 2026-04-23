import { NextResponse } from "next/server";
import { BACKEND_URL, backendGet, BackendPatient } from "@/lib/backend";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ patientId: string }> }
) {
  try {
    const { patientId } = await params;
    const current = await backendGet<BackendPatient>(`/v1/patients/${patientId}`);

    const res = await fetch(`${BACKEND_URL}/v1/patients/${patientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: current.name,
        budget_hours: current.budget_hours,
        max_dose_per_week: current.max_dose_per_week,
        age_standardized: current.age_standardized,
        weeks_since_stroke: current.weeks_since_stroke,
        horizon_weeks: current.horizon_weeks,
      }),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Backend model update failed: ${res.status}`);

    return NextResponse.json({ result: "ok" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Retrain error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
