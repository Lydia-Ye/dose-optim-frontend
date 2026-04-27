import { NextResponse } from "next/server";
import { backendPost, BackendModelResponse } from "@/lib/backend";

interface BackendOptimizeResponse extends BackendModelResponse {
  schedule_hours: number[];
  convergence: number[];
}

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
    const n_samples: number = data.n_samples ?? 300;
    const n_iters: number   = data.n_iters   ?? 60;
    const seed: number | null = data.seed ?? null;

    const result = await backendPost<BackendOptimizeResponse>(
      `/v1/patients/${patientId}/optimize`,
      { n_samples, n_iters, seed },
    );

    const { trajectories: traj, latent_trajectories: latent, latent_states: states } = result;

    return NextResponse.json({
      scheduleHours: result.schedule_hours,
      convergence:   result.convergence,

      // Smooth latent means (epistemic uncertainty only)
      maxPrediction:  latent.mal.p95.map((v) => v * latent.mal.scale),
      minPrediction:  latent.mal.p05.map((v) => v * latent.mal.scale),
      meanPrediction: latent.mal.mean.map((v) => v * latent.mal.scale),
      dosage: result.schedule_hours,

      malSmooth:  scaleBand(latent.mal,  latent.mal.scale),
      uefmSmooth: scaleBand(latent.uefm, latent.uefm.scale),
      wmftSmooth: scaleBand(latent.wmft, latent.wmft.scale),

      mal:  scaleBand(traj.mal,  traj.mal.scale),
      uefm: scaleBand(traj.uefm, traj.uefm.scale),
      wmft: scaleBand(traj.wmft, traj.wmft.scale),

      s:  scaleBand(states.s,   1.0),
      rM: scaleBand(states.r_m, 1.0),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Optimize error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
