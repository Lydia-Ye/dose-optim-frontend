import { Patient } from "@/types/patient";

type Band = { mean: number[]; p05: number[]; p95: number[] };
export type NotebookSnapshotWeek = 1 | 7 | 14 | 21;

export interface NotebookOptimizeResponse {
  scheduleHours: number[];
  totalHours: number;
  convergence: number[];
  maxPrediction: number[];
  minPrediction: number[];
  meanPrediction: number[];
  dosage: number[];
  malSmooth: Band;
  uefmSmooth: Band;
  wmftSmooth: Band;
  mal: Band;
  uefm: Band;
  wmft: Band;
  s: Band;
  rM: Band;
}

const modelBayesian = { modelAlias: "adaptive-notebook", modelUri: "notebook://adaptive_scheduling" };
const modelSGLD = { modelAlias: "adaptive-notebook", modelUri: "notebook://adaptive_scheduling" };
const NOTEBOOK_HORIZON_WEEKS = 52;
export const NOTEBOOK_DOSE_HORIZON_WEEKS = 26;
// Default snapshot: week 7 leaves meaningful remaining budget for manual scheduling demo
const NOTEBOOK_SNAPSHOT_WEEK = 7;

// ---------------------------------------------------------------------------
// State-space dynamics from adaptive_scheduling.ipynb
// Matches: evolve_state / simulate exactly
// ---------------------------------------------------------------------------

const DOSE_NORM = 26.62;
const ALPHA_P = 0.85;
const ALPHA_O = 0.750279040360377;
const C0 = 0.0396425020286469;
const BETA_R = 0.25721938996658;
const BETA_F = 0.0256360652472847;

interface SubjectParams {
  sinit_n: number;
  alpha_r: number;
  alpha_s: number;
  m_s_mal: number;
  m_r_uefm: number;
  m_s_wmft: number;
  m_r_wmft: number;
  cst: number;
  proportion: number;
}

// True parameters from adaptive_scheduling.ipynb (subject 1: g=0, age=52, conc=0)
const PARAMS_S1: SubjectParams = {
  sinit_n: 0.45655985,
  alpha_r:  0.92007295,
  alpha_s:  0.95898605,
  m_s_mal:  0.43661443,
  m_r_uefm: 0.12808793,
  m_s_wmft: 0.80793006,
  m_r_wmft: 0.29811979,
  cst:       1.33735547,
  proportion: 0.21404407,
};

// True parameters from adaptive_scheduling.ipynb (subject 2: g=1, age=60, conc=1)
const PARAMS_S2: SubjectParams = {
  sinit_n: 0.64289629,
  alpha_r:  0.94901764,
  alpha_s:  0.92846270,
  m_s_mal:  0.36227230,
  m_r_uefm: 0.17691457,
  m_s_wmft: 0.72314731,
  m_r_wmft: 0.35062007,
  cst:       1.43809090,
  proportion: 0.71495171,
};

function smoothClamp(x: number, k = 50.0): number {
  const xf = 0.001 + Math.log1p(Math.exp(Math.max(-500, Math.min(k * (x - 0.001), 500)))) / k;
  return 0.999 - Math.log1p(Math.exp(Math.max(-500, Math.min(k * (0.999 - xf), 500)))) / k;
}

function computeNormO(ntime: number): number[] {
  const raw: number[] = new Array(ntime);
  let pState = 1.0;
  let oVal = 0.0;
  for (let t = 0; t < ntime; t++) {
    pState = ALPHA_P * pState + (t === 0 ? 1.0 : C0);
    oVal = ALPHA_O * oVal + pState;
    raw[t] = oVal;
  }
  const maxVal = Math.max(...raw);
  return raw.map((v) => v / maxVal);
}

function simulate(
  dosesHours: number[],
  p: SubjectParams,
): { mal: number[]; uefm: number[]; wmft: number[] } {
  const tMax = dosesHours.length;
  const mal: number[] = new Array(tMax);
  const uefm: number[] = new Array(tMax);
  const wmft: number[] = new Array(tMax);
  let s = p.sinit_n;
  let rM = 0.0;
  const normO = computeNormO(tMax);
  const sTarget = p.proportion + (1.0 - p.proportion) * p.sinit_n;

  for (let t = 0; t < tMax; t++) {
    const doseNorm = dosesHours[t] / DOSE_NORM;
    const predM = smoothClamp(s * p.m_s_mal + rM);
    const predU = smoothClamp(s + rM * p.m_r_uefm);
    const predW = smoothClamp(s * p.m_s_wmft + rM * p.m_r_wmft);
    const eff = p.cst * normO[t] * doseNorm;
    const sNext = p.alpha_s * s + sTarget * (1.0 - p.alpha_s);
    const rNext = p.alpha_r * rM + eff * BETA_R + BETA_F * predM;
    mal[t] = predM * 5.0;
    uefm[t] = predU * 66.0;
    wmft[t] = predW;
    s = sNext;
    rM = rNext;
  }
  return { mal, uefm, wmft };
}

// ---------------------------------------------------------------------------
// Dose schedules from adaptive_scheduling.ipynb run
// budget=30h, dose weeks 0-25 only, total delivered: S1=29.5h, S2=30.0h
// ---------------------------------------------------------------------------

const subject1Doses = [
  0.0, 0.5, 1.0, 2.5, 5.0, 2.0, 9.0, 0.0, 0.0, 7.5, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  1.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
];

const subject2Doses = [
  0.0, 0.0, 0.5, 2.0, 8.0, 0.5, 3.0, 7.5, 8.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
];

// Pre-computed trajectories (deterministic forward simulation with true params)
const { mal: subject1Mal, uefm: subject1Uefm, wmft: subject1Wmft } = simulate(subject1Doses, PARAMS_S1);
const { mal: subject2Mal, uefm: subject2Uefm, wmft: subject2Wmft } = simulate(subject2Doses, PARAMS_S2);

// ---------------------------------------------------------------------------
// Patient records
// ---------------------------------------------------------------------------

export const adaptiveNotebookPatients: Patient[] = [
  {
    id: "adaptive-notebook-1",
    sourceSubjectId: null,
    displayId: "376",
    name: "376",
    past: false,
    budget: 30,
    maxDose: 10,
    age: 52,
    weeksSinceStroke: 0,
    leftStroke: false,
    male: true,
    horizon: NOTEBOOK_HORIZON_WEEKS,
    doseHorizon: NOTEBOOK_DOSE_HORIZON_WEEKS,
    outcomes: subject1Mal.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    actions: subject1Doses.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedMal: subject1Mal.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedUefm: subject1Uefm.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedWmft: subject1Wmft.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    modelBayesian,
    modelSGLD,
  },
  {
    id: "adaptive-notebook-2",
    sourceSubjectId: null,
    displayId: "377",
    name: "377",
    past: false,
    budget: 30,
    maxDose: 10,
    age: 60,
    weeksSinceStroke: 0,
    leftStroke: false,
    male: false,
    horizon: NOTEBOOK_HORIZON_WEEKS,
    doseHorizon: NOTEBOOK_DOSE_HORIZON_WEEKS,
    outcomes: subject2Mal.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    actions: subject2Doses.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedMal: subject2Mal.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedUefm: subject2Uefm.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedWmft: subject2Wmft.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    modelBayesian,
    modelSGLD,
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getAdaptiveNotebookPatient(id: string): Patient | undefined {
  const normalizedId = id.trim().toLowerCase();
  return adaptiveNotebookPatients.find((patient) => (
    patient.id.toLowerCase() === normalizedId ||
    patient.displayId.toLowerCase() === normalizedId ||
    patient.name.toLowerCase() === normalizedId
  ));
}

export function isAdaptiveNotebookPatient(id: string): boolean {
  return getAdaptiveNotebookPatient(id) !== undefined;
}

export function getAdaptiveNotebookSnapshot(id: string, week: NotebookSnapshotWeek) {
  const patient = getAdaptiveNotebookPatient(id);
  if (!patient) return undefined;

  const isSubject2 = patient.id.endsWith("2");
  const end = week + 1;
  return {
    week,
    outcomes:    (isSubject2 ? subject2Mal  : subject1Mal).slice(0, end),
    actions:     (isSubject2 ? subject2Doses : subject1Doses).slice(0, end),
    observedMal:  (isSubject2 ? subject2Mal  : subject1Mal).slice(0, end),
    observedUefm: (isSubject2 ? subject2Uefm : subject1Uefm).slice(0, end),
    observedWmft: (isSubject2 ? subject2Wmft : subject1Wmft).slice(0, end),
  };
}

// ---------------------------------------------------------------------------
// Prediction responses — use actual state-space simulation, not delta approx
// ---------------------------------------------------------------------------

export function getAdaptiveNotebookOptimizeResponse(id: string): NotebookOptimizeResponse | undefined {
  const patient = getAdaptiveNotebookPatient(id);
  if (!patient) return undefined;

  const isSubject2 = patient.id.endsWith("2");
  return buildNotebookResponse(
    isSubject2 ? subject2Mal  : subject1Mal,
    isSubject2 ? subject2Doses : subject1Doses,
    isSubject2 ? subject2Uefm : subject1Uefm,
    isSubject2 ? subject2Wmft : subject1Wmft,
  );
}

export function getAdaptiveNotebookManualPredictResponse(
  id: string,
  scheduleHours: number[],
): NotebookOptimizeResponse | undefined {
  const patient = getAdaptiveNotebookPatient(id);
  if (!patient) return undefined;

  const isSubject2 = patient.id.endsWith("2");
  const params = isSubject2 ? PARAMS_S2 : PARAMS_S1;

  // Pad / trim to exactly NOTEBOOK_HORIZON_WEEKS
  const doses = Array.from(
    { length: NOTEBOOK_HORIZON_WEEKS },
    (_, i) => Number(scheduleHours[i] ?? 0),
  );

  // Run actual notebook dynamics — no approximation
  const { mal, uefm, wmft } = simulate(doses, params);

  return buildNotebookResponse(mal, doses, uefm, wmft);
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

function band(mean: number[], width: number, min = 0, max = Number.POSITIVE_INFINITY): Band {
  return {
    mean,
    p05: mean.map((v) => Math.max(min, v - width)),
    p95: mean.map((v) => Math.min(max, v + width)),
  };
}

function buildNotebookResponse(
  malMean: number[],
  scheduleHours: number[],
  uefmMean: number[],
  wmftMean: number[],
): NotebookOptimizeResponse {
  const sMean  = malMean.map((v) => Math.min(1, 0.18 + (v / 5) * 0.095));
  const rMMean = malMean.map((v, i) => Math.min(1, 0.02 + (v / 5) * 0.045 + i * 0.006));

  const malSmooth = band(malMean, 0.28, 0, 5);
  return {
    scheduleHours,
    totalHours: scheduleHours.reduce((sum, h) => sum + h, 0),
    convergence: Array.from({ length: 45 }, (_, i) => 0.05 + Math.log1p(i + 1) * 0.035),
    maxPrediction: malSmooth.p95,
    minPrediction: malSmooth.p05,
    meanPrediction: malSmooth.mean,
    dosage: scheduleHours,
    malSmooth,
    uefmSmooth: band(uefmMean, 3.2, 0, 66),
    wmftSmooth: band(wmftMean, 0.07, 0, 1),
    mal:  band(malMean,  0.45, 0, 5),
    uefm: band(uefmMean, 5.5,  0, 66),
    wmft: band(wmftMean, 0.11, 0, 1),
    s:    band(sMean,   0.05, 0, 1),
    rM:   band(rMMean,  0.06, 0, 1),
  };
}
