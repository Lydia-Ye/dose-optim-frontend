import { NextResponse } from "next/server";
import { backendPost, BackendModelResponse } from "@/lib/backend";
import { ResultsPostRequest } from "@/types/resultsPostRequest";
import { ResultsPostResponse } from "@/types/resultsPostResponse";

export async function POST(req: Request) {
  try {
    const data: ResultsPostRequest = await req.json();
    const patientId = String(data.id);

    const model = await backendPost<BackendModelResponse>(
      `/v1/patients/${patientId}/optimize`,
      { n_samples: 300, n_iters: 60 }
    );

    const mal = model.trajectories.mal;
    const scale = mal.scale;
    const schedule = model.recommended_schedule!;

    const response: ResultsPostResponse = {
      message: "Results obtained",
      meanOutcome: mal.mean.map((v) => v * scale),
      minOutcome: mal.p05.map((v) => v * scale),
      maxOutcome: mal.p95.map((v) => v * scale),
      dosage: schedule.dose_hours_per_week,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to obtain results" }, { status: 500 });
  }
}

export async function PUT(_req: Request) {
  return NextResponse.json({ result: null });
}
