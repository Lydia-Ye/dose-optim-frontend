import { NextResponse } from "next/server";
import { BACKEND_URL, backendGet, BackendPatient } from "@/lib/backend";
import { ResultsPutRequest } from "@/types/resultsPutRequest";

export async function POST() {
  return NextResponse.json(
    { error: "The optimize endpoint has been removed. Use /api/manual-predict instead." },
    { status: 410 }
  );
}

export async function PUT(req: Request) {
  try {
    const { patientID, pastAvgOutState, pastDoseDataState } = await req.json() as ResultsPutRequest;
    const current = await backendGet<BackendPatient>(`/v1/patients/${patientID}`);

    // Upsert one observation per time step
    for (let i = 0; i < pastAvgOutState.length; i++) {
      const body = {
        week: i,
        dose_hours: pastDoseDataState[i] ?? 0,
        mal_score: pastAvgOutState[i] ?? null,
      };

      const res = await fetch(`${BACKEND_URL}/v1/patients/${patientID}/observations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to save observation week ${i}: ${res.status} ${text}`);
      }
    }

    const removedObservations = current.observations.filter(
      (obs) => obs.week >= pastAvgOutState.length
    );

    for (const obs of removedObservations) {
      const res = await fetch(`${BACKEND_URL}/v1/patients/${patientID}/observations/${obs.week}`, {
        method: "DELETE",
        cache: "no-store",
      });

      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        throw new Error(`Failed to delete observation week ${obs.week}: ${res.status} ${text}`);
      }
    }

    return NextResponse.json({ result: "ok" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Results PUT error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
