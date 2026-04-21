import { NextResponse } from "next/server";
import { backendPost, BackendModelResponse } from "@/lib/backend";

function scaleBand(
  band: { mean: number[]; p05: number[]; p95: number[] },
  scale: number,
) {
  return {
    mean: band.mean.map((v) => v * scale),
    p05:  band.p05.map((v) => v * scale),
    p95:  band.p95.map((v) => v * scale),
  };
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const patientId = String(data.id);
    const futureActions: number[] = data.future_actions ?? [];

    const model = await backendPost<BackendModelResponse>(
      `/v1/patients/${patientId}/manual-predict`,
      { dose_hours_per_week: futureActions, n_samples: 500 },
    );

    const { trajectories: traj, latent_trajectories: latent, latent_states: states } = model;

    return NextResponse.json({
      // MAL smooth mean (epistemic uncertainty only) — matches notebook Row 1
      maxPrediction:  latent.mal.p95.map((v) => v * latent.mal.scale),
      minPrediction:  latent.mal.p05.map((v) => v * latent.mal.scale),
      meanPrediction: latent.mal.mean.map((v) => v * latent.mal.scale),
      dosage: futureActions,

      // Smooth means — epistemic uncertainty only (notebook Row 1)
      malSmooth:  scaleBand(latent.mal,  latent.mal.scale),
      uefmSmooth: scaleBand(latent.uefm, latent.uefm.scale),
      wmftSmooth: scaleBand(latent.wmft, latent.wmft.scale),

      // Noisy observations — epistemic + Beta noise (notebook Row 2)
      mal:  scaleBand(traj.mal,  traj.mal.scale),
      uefm: scaleBand(traj.uefm, traj.uefm.scale),
      wmft: scaleBand(traj.wmft, traj.wmft.scale),

      // Latent states
      s:  scaleBand(states.s,   1.0),
      rM: scaleBand(states.r_m, 1.0),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Manual prediction error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
