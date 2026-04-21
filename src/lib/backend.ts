/**
 * Thin adapter between the FastAPI backend and the frontend's Patient type.
 *
 * All backend calls go through the BACKEND_URL env var (server-side only).
 * Never import this in client components.
 */

import { Patient } from "@/types/patient";

export const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Backend response shapes (subset we actually use)
// ---------------------------------------------------------------------------

export interface BackendPatient {
  id: string;
  name: string;
  is_past: boolean;
  budget_hours: number;
  max_dose_per_week: number;
  age_standardized: number;
  weeks_since_stroke: number;
  concurrent_therapy: boolean;
  horizon_weeks: number;
  treatment_start_week: number;
  n_treatment_weeks: number;
  observations: Array<{ week: number; dose_hours: number; mal_score: number | null }>;
  alpha_r: number | null;
  sinit_n: number | null;
}

export interface BackendModelResponse {
  patient_id: string;
  horizon_weeks: number;
  parameter_source: string;
  trajectories: {
    mal:  { mean: number[]; sd: number[]; p05: number[]; p95: number[]; scale: number };
    uefm: { mean: number[]; sd: number[]; p05: number[]; p95: number[]; scale: number };
    wmft: { mean: number[]; sd: number[]; p05: number[]; p95: number[]; scale: number };
  };
  recommended_schedule?: {
    dose_hours_per_week: number[];
    total_hours: number;
    cem_convergence: number[];
  };
  n_samples: number;
}

// ---------------------------------------------------------------------------
// Converters
// ---------------------------------------------------------------------------

/** Convert backend patient list item → frontend Patient (no trajectory yet). */
export function toFrontendPatient(p: BackendPatient): Patient {
  return {
    id: p.id,
    name: p.name,
    past: p.is_past,
    budget: p.budget_hours,
    maxDose: p.max_dose_per_week,
    age: Math.round(p.age_standardized * 75 + 18),
    weeksSinceStroke: p.weeks_since_stroke,
    leftStroke: false,
    male: false,
    horizon: p.horizon_weeks,
    outcomes: [],
    actions: [],
    modelBayesian: { modelAlias: p.id, modelUri: `backend://${p.id}` },
    modelSGLD:     { modelAlias: p.id, modelUri: `backend://${p.id}` },
  };
}

/**
 * Enrich a frontend Patient with trajectory data from a ModelResponse.
 * outcomes = predicted MAL (0-5 scale), actions = dose hours per week.
 */
export function enrichWithTrajectory(
  patient: Patient,
  detail: BackendPatient,
  model: BackendModelResponse,
): Patient {
  const horizonWeeks = detail.horizon_weeks;

  // Build per-week dose array from observations (zero-filled for missing weeks)
  const actions = new Array<number>(horizonWeeks).fill(0);
  for (const obs of detail.observations) {
    if (obs.week >= 0 && obs.week < horizonWeeks) {
      actions[obs.week] = obs.dose_hours;
    }
  }

  // Predicted MAL trajectory (model output 0-1 → clinical 0-5)
  const malMean = model.trajectories.mal.mean;
  const scale = model.trajectories.mal.scale;  // 5.0
  // malMean has length horizon_weeks+1 (initial state + each step); take first horizon_weeks+1
  const outcomes = malMean.slice(0, horizonWeeks + 1).map(x => x * scale);

  return { ...patient, outcomes, actions };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

export async function backendGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Backend GET ${path} → ${res.status}`);
  return res.json();
}

export async function backendPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Backend POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

export async function backendPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend PUT ${path} → ${res.status}`);
  return res.json();
}
