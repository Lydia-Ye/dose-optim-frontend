import { NextResponse } from "next/server";
import { backendPost, BackendModelResponse } from "@/lib/backend";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const patientId = String(data.id);
    const futureActions: number[] = data.future_actions ?? [];

    const model = await backendPost<BackendModelResponse>(
      `/v1/patients/${patientId}/manual-predict`,
      { dose_hours_per_week: futureActions, n_samples: 200 }
    );

    const mal = model.trajectories.mal;
    const scale = mal.scale;

    return NextResponse.json({
      maxPrediction: mal.p95.map((v) => v * scale),
      minPrediction: mal.p05.map((v) => v * scale),
      meanPrediction: mal.mean.map((v) => v * scale),
      dosage: futureActions,
    });
  } catch (error) {
    console.error("Manual prediction error:", error);
    return NextResponse.json(
      { error: "Failed to generate manual predictions" },
      { status: 500 }
    );
  }
}
