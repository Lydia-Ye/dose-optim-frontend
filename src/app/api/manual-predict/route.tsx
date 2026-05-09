import { NextResponse } from "next/server";
import { backendPost, BackendModelResponse } from "@/lib/backend";
import {
  isAdaptiveNotebookPatient,
  getAdaptiveNotebookPatient,
  NOTEBOOK_HORIZON_WEEKS,
  NOTEBOOK_SNAPSHOT_WEEK,
  SUBJ_CTX_S1,
  SUBJ_CTX_S2,
  subject1Doses,
  subject2Doses,
  subject1Mal,
  subject1Uefm,
  subject1Wmft,
  subject2Mal,
  subject2Uefm,
  subject2Wmft,
} from "@/lib/adaptiveNotebookPatients";

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
    const rawPatientId = data.id ?? data.patientId ?? data.patientID;
    if (rawPatientId == null) {
      return NextResponse.json({ error: "Missing patient id" }, { status: 400 });
    }
    const patientId = String(rawPatientId);
    const futureActions: number[] = data.future_actions ?? [];

    // ---------------------------------------------------------------------------
    // Adaptive notebook patients: run real Stan HMC on the backend
    // ---------------------------------------------------------------------------
    if (isAdaptiveNotebookPatient(patientId)) {
      const patient = getAdaptiveNotebookPatient(patientId)!;
      const isSubject2 = patient.id.endsWith("2");

      const ctx        = isSubject2 ? SUBJ_CTX_S2    : SUBJ_CTX_S1;
      const malObs     = isSubject2 ? subject2Mal    : subject1Mal;
      const uefmObs    = isSubject2 ? subject2Uefm   : subject1Uefm;
      const wmftObs    = isSubject2 ? subject2Wmft   : subject1Wmft;
      const pastDoses  = isSubject2 ? subject2Doses  : subject1Doses;

      // Observations for HMC: weeks 1 through NOTEBOOK_SNAPSHOT_WEEK (week 0 unobserved)
      const obsCount = NOTEBOOK_SNAPSHOT_WEEK;   // 7 observations at weeks 1..7
      const obs_weeks = Array.from({ length: obsCount }, (_, i) => i + 1);  // [1,2,...,7]
      // Normalise to [0,1] for Stan (clinical units → model units); slice indices 1..7
      const obs_mal  = malObs.slice(1, 1 + obsCount).map((v) => v / 5.0);
      const obs_uefm = uefmObs.slice(1, 1 + obsCount).map((v) => v / 66.0);
      const obs_wmft = wmftObs.slice(1, 1 + obsCount);     // already [0,1]

      // Full dose schedule: past doses weeks 0..SNAPSHOT fixed from notebook, future from user
      const pastDoseCutoff = NOTEBOOK_SNAPSHOT_WEEK + 1;   // 8
      const future_doses_hours = Array.from(
        { length: NOTEBOOK_HORIZON_WEEKS },
        (_, i) => (i < pastDoseCutoff ? pastDoses[i] : Number(futureActions[i] ?? 0)),
      );

      const model = await backendPost<BackendModelResponse>("/v1/hmc-predict", {
        group:              ctx.g,
        age_std:            ctx.ageStd,
        conc:               ctx.conc,
        obs_weeks,
        obs_mal,
        obs_uefm,
        obs_wmft,
        future_doses_hours,
        horizon_weeks:      NOTEBOOK_HORIZON_WEEKS,
        n_mc:               200,
        seed:               42,
      });

      const { trajectories: traj, latent_trajectories: latent, latent_states: states } = model;

      return NextResponse.json({
        maxPrediction:  latent.mal.p95.map((v) => v * latent.mal.scale),
        minPrediction:  latent.mal.p05.map((v) => v * latent.mal.scale),
        meanPrediction: latent.mal.mean.map((v) => v * latent.mal.scale),
        dosage: futureActions,
        malSmooth:  scaleBand(latent.mal,  latent.mal.scale),
        uefmSmooth: scaleBand(latent.uefm, latent.uefm.scale),
        wmftSmooth: scaleBand(latent.wmft, latent.wmft.scale),
        mal:  scaleBand(traj.mal,  traj.mal.scale),
        uefm: scaleBand(traj.uefm, traj.uefm.scale),
        wmft: scaleBand(traj.wmft, traj.wmft.scale),
        s:  scaleBand(states.s,   1.0),
        rM: scaleBand(states.r_m, 1.0),
      });
    }

    // ---------------------------------------------------------------------------
    // All other patients: delegate to the regular backend endpoint
    // ---------------------------------------------------------------------------
    const model = await backendPost<BackendModelResponse>(
      `/v1/patients/${patientId}/manual-predict`,
      { dose_hours_per_week: futureActions, n_samples: 500 },
    );

    const { trajectories: traj, latent_trajectories: latent, latent_states: states } = model;

    return NextResponse.json({
      maxPrediction:  latent.mal.p95.map((v) => v * latent.mal.scale),
      minPrediction:  latent.mal.p05.map((v) => v * latent.mal.scale),
      meanPrediction: latent.mal.mean.map((v) => v * latent.mal.scale),
      dosage: futureActions,
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
    console.error("Manual prediction error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
