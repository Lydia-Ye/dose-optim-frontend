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

interface BackendOptimizeResponse extends BackendModelResponse {
  schedule_hours?: number[];
  convergence?: number[];
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
    const rawPatientId = data.id ?? data.patientId ?? data.patientID;
    if (rawPatientId == null) {
      return NextResponse.json({ error: "Missing patient id" }, { status: 400 });
    }
    const patientId = String(rawPatientId);
    const n_samples: number = data.n_samples ?? 300;
    const n_iters: number   = data.n_iters   ?? 60;
    const seed: number | null = data.seed ?? null;

    // ---------------------------------------------------------------------------
    // Adaptive notebook patients: run HMC on the week-7 observations, then
    // run the same notebook CEM process from that adaptive snapshot.
    // ---------------------------------------------------------------------------
    if (isAdaptiveNotebookPatient(patientId)) {
      const patient = getAdaptiveNotebookPatient(patientId)!;
      const isSubject2 = patient.id.endsWith("2");

      const ctx        = isSubject2 ? SUBJ_CTX_S2    : SUBJ_CTX_S1;
      const malObs     = isSubject2 ? subject2Mal    : subject1Mal;
      const uefmObs    = isSubject2 ? subject2Uefm   : subject1Uefm;
      const wmftObs    = isSubject2 ? subject2Wmft   : subject1Wmft;
      const pastDoses  = isSubject2 ? subject2Doses  : subject1Doses;
      // Observations at weeks 1..NOTEBOOK_SNAPSHOT_WEEK (week 0 is unobserved in notebook)
      const obsCount = NOTEBOOK_SNAPSHOT_WEEK;   // 7 observations at weeks 1..7
      const obs_weeks = Array.from({ length: obsCount }, (_, i) => i + 1);  // [1,2,...,7]
      const obs_mal  = malObs.slice(1, 1 + obsCount).map((v) => v / 5.0);
      const obs_uefm = uefmObs.slice(1, 1 + obsCount).map((v) => v / 66.0);
      const obs_wmft = wmftObs.slice(1, 1 + obsCount);

      const model = await backendPost<BackendModelResponse>("/v1/hmc-predict", {
        group:              ctx.g,
        age_std:            ctx.ageStd,
        conc:               ctx.conc,
        obs_weeks,
        obs_mal,
        obs_uefm,
        obs_wmft,
        future_doses_hours: Array.from({ length: NOTEBOOK_HORIZON_WEEKS }, () => 0),
        optimize_cem:       true,
        delivered_doses_hours: pastDoses.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
        budget_hours:       patient.budget,
        dose_horizon_weeks: patient.doseHorizon,
        max_dose_hours:     patient.maxDose,
        planning_week:      NOTEBOOK_SNAPSHOT_WEEK + 1,
        horizon_weeks:      NOTEBOOK_HORIZON_WEEKS,
        n_mc:               200,
        seed:               9000 + (isSubject2 ? 100 : 0) + NOTEBOOK_SNAPSHOT_WEEK,
        cem_n_samples:      250,
        cem_n_iters:        45,
        cem_seed:           (isSubject2 ? 100 : 0) + NOTEBOOK_SNAPSHOT_WEEK + 1,
      });

      const { trajectories: traj, latent_trajectories: latent, latent_states: states } = model;
      const cemScheduleHours = model.recommended_schedule?.dose_hours_per_week ?? [];
      const observedDoseCutoff = NOTEBOOK_SNAPSHOT_WEEK + 1;
      const scheduleHours = Array.from({ length: NOTEBOOK_HORIZON_WEEKS }, (_, week) => (
        week < observedDoseCutoff
          ? (pastDoses[week] ?? 0)
          : (cemScheduleHours[week] ?? 0)
      ));

      return NextResponse.json({
        scheduleHours,
        totalHours: scheduleHours.reduce((s, h) => s + h, 0),
        convergence: model.recommended_schedule?.cem_convergence ?? [],
        maxPrediction:  latent.mal.p95.map((v) => v * latent.mal.scale),
        minPrediction:  latent.mal.p05.map((v) => v * latent.mal.scale),
        meanPrediction: latent.mal.mean.map((v) => v * latent.mal.scale),
        dosage: scheduleHours,
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
    // All other patients: delegate to the regular backend CEM optimizer
    // ---------------------------------------------------------------------------
    const result = await backendPost<BackendOptimizeResponse>(
      `/v1/patients/${patientId}/optimize`,
      { n_samples, n_iters, seed },
    );

    const { trajectories: traj, latent_trajectories: latent, latent_states: states } = result;
    const scheduleHours = result.recommended_schedule?.dose_hours_per_week ?? result.schedule_hours ?? [];
    const convergence = result.recommended_schedule?.cem_convergence ?? result.convergence ?? [];

    return NextResponse.json({
      scheduleHours,
      totalHours: result.recommended_schedule?.total_hours ?? scheduleHours.reduce((sum, hours) => sum + hours, 0),
      convergence,
      maxPrediction:  latent.mal.p95.map((v) => v * latent.mal.scale),
      minPrediction:  latent.mal.p05.map((v) => v * latent.mal.scale),
      meanPrediction: latent.mal.mean.map((v) => v * latent.mal.scale),
      dosage: scheduleHours,
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
