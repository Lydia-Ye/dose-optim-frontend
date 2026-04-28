import { NextResponse } from "next/server";
import { backendGet, toFrontendPatient, BackendPatient, BACKEND_URL } from "@/lib/backend";
import { PatientinfoPutRequest } from "@/types/patientinfoRoute";

export async function PUT(req: Request) {
  try {
    const data: PatientinfoPutRequest = await req.json();
    const patientId = data.patientID;

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
        n_treatment_weeks: data.newHorizon,
        horizon_weeks: data.newHorizon,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Backend PUT → ${res.status}`);

    const updated = await res.json();
    const patient = toFrontendPatient(updated);

    return NextResponse.json({ message: "Patient info updated", patient });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update patient info" }, { status: 500 });
  }
}
