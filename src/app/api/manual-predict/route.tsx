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

// Linearly scales CI half-width from 0.5× at index 0 to 2× at the last index.
function widenBand(band: { mean: number[]; p05: number[]; p95: number[] }) {
  const n = band.mean.length;
  const denom = Math.max(n - 1, 1);
  return {
    mean: band.mean,
    p05: band.p05.map((lo, i) => {
      const hi = band.p95[i];
      const center = (lo + hi) / 2;
      const half = (hi - lo) / 2;
      const factor = 0.5 + 1.5 * (i / denom);
      return center - factor * half;
    }),
    p95: band.p95.map((hi, i) => {
      const lo = band.p05[i];
      const center = (lo + hi) / 2;
      const half = (hi - lo) / 2;
      const factor = 0.5 + 1.5 * (i / denom);
      return center + factor * half;
    }),
  };
}

function finiteAt(values: unknown, index: number): number | undefined {
  if (!Array.isArray(values)) return undefined;
  const value = Number(values[index]);
  return Number.isFinite(value) ? value : undefined;
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

      const submittedDoses = Array.isArray(data.delivered_doses_hours)
        ? data.delivered_doses_hours.map((v: unknown) => Number(v))
        : [];
      const requestedSnapshot = Number(data.snapshot_week);
      const snapshotWeek = Math.max(
        1,
        Math.min(
          NOTEBOOK_HORIZON_WEEKS - 1,
          Number.isFinite(requestedSnapshot)
            ? Math.floor(requestedSnapshot)
            : Math.max(NOTEBOOK_SNAPSHOT_WEEK, submittedDoses.length - 1),
        ),
      );

      // Observations for HMC: weeks 1 through the displayed snapshot
      // (week 0 is unobserved in the notebook).
      const obs_weeks = Array.from({ length: snapshotWeek }, (_, i) => i + 1);
      const obs_mal = obs_weeks.map((week) => (
        (finiteAt(data.observed_mal, week) ?? malObs[week]) / 5.0
      ));
      const obs_uefm = obs_weeks.map((week) => (
        (finiteAt(data.observed_uefm, week) ?? uefmObs[week]) / 66.0
      ));
      const obs_wmft = obs_weeks.map((week) => (
        finiteAt(data.observed_wmft, week) ?? wmftObs[week]
      ));

      // Full dose schedule: past doses weeks 0..SNAPSHOT fixed from notebook,
      // future doses from the submitted manual schedule. The current client
      // sends a full-horizon array, but accepting future-only arrays keeps this
      // endpoint aligned with the API field name and avoids silent week shifts.
      const pastDoseCutoff = snapshotWeek + 1;
      const futureScheduleOffset = futureActions.length === NOTEBOOK_HORIZON_WEEKS
        ? 0
        : pastDoseCutoff;
      const future_doses_hours = Array.from(
        { length: NOTEBOOK_HORIZON_WEEKS },
        (_, week) => (
          week < pastDoseCutoff
            ? (Number.isFinite(submittedDoses[week]) ? submittedDoses[week] : pastDoses[week])
            : Number(futureActions[week - futureScheduleOffset] ?? 0)
        ),
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
        dosage: future_doses_hours,
        malSmooth:  scaleBand(latent.mal,  latent.mal.scale),
        uefmSmooth: widenBand(scaleBand(latent.uefm, latent.uefm.scale)),
        wmftSmooth: widenBand(scaleBand(latent.wmft, latent.wmft.scale)),
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
      uefmSmooth: widenBand(scaleBand(latent.uefm, latent.uefm.scale)),
      wmftSmooth: widenBand(scaleBand(latent.wmft, latent.wmft.scale)),
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
