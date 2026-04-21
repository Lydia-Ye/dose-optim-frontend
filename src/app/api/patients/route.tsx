import { NextResponse } from "next/server";
import { backendGet, backendPost, toFrontendPatient, BackendPatient, BACKEND_URL } from "@/lib/backend";

export async function GET() {
  try {
    const patients = await backendGet<BackendPatient[]>("/v1/patients");
    return NextResponse.json(patients.map(toFrontendPatient));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch patients" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const backendBody = {
      name: data.name,
      age_standardized: (data.age - 18) / 75,
      concurrent_therapy: false,
      budget_hours: data.budget,
      max_dose_per_week: data.maxDose,
      weeks_since_stroke: data.weeksSinceStroke ?? 0,
      treatment_start_week: 0,
      n_treatment_weeks: data.horizon,
      horizon_weeks: data.horizon,
    };

    const created = await backendPost<BackendPatient>("/v1/patients", backendBody);
    const patient = toFrontendPatient(created);
    return NextResponse.json({ message: "Patient added", patient });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create patient" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const data = await req.json();
    const patientId = data.patientID;

    const backendBody = {
      name: data.name,
      budget_hours: data.budget,
      max_dose_per_week: data.maxDose,
      age_standardized: (data.context?.age - 18) / 75,
      weeks_since_stroke: data.context?.weeksSinceStroke ?? 0,
      horizon_weeks: data.horizon,
    };

    const res = await fetch(`${BACKEND_URL}/v1/patients/${patientId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(backendBody),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Backend PUT → ${res.status}`);
    const updated = await res.json();
    const patient = toFrontendPatient(updated);

    return NextResponse.json({
      message: "Patient updated",
      patient,
      newModelId: "0",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update patient" }, { status: 500 });
  }
}
