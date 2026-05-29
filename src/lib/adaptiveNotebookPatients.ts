import { Patient } from "@/types/patient";

export type NotebookSnapshotWeek = 1 | 7 | 14 | 21;

const modelBayesian = { modelAlias: "adaptive-notebook", modelUri: "notebook://adaptive_scheduling" };
const modelSGLD = { modelAlias: "adaptive-notebook", modelUri: "notebook://adaptive_scheduling" };
export const NOTEBOOK_HORIZON_WEEKS = 52;
export const NOTEBOOK_DOSE_HORIZON_WEEKS = 26;
// Default snapshot: week 7 leaves meaningful remaining budget for manual scheduling demo
export const NOTEBOOK_SNAPSHOT_WEEK = 7;

// ---------------------------------------------------------------------------
// State-space dynamics constants from adaptive_scheduling.ipynb
// ---------------------------------------------------------------------------

const DOSE_NORM = 26.62;
const ALPHA_P = 0.85;
const ALPHA_O = 0.750279040360377;
const C0 = 0.0396425020286469;
const BETA_R = 0.25721938996658;
const BETA_F = 0.0256360652472847;

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

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
// Dose schedules from the saved adaptive_scheduling.ipynb run.
// budget=30h, dose weeks 0-25 only, total delivered: S1=30.0h, S2=30.0h
// ---------------------------------------------------------------------------

export const subject1Doses = [
  0.0, 0.5, 1.5, 6.0, 1.0, 0.5, 7.5, 2.5, 10.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
];

export const subject2Doses = [
  0.0, 0.0, 0.5, 0.0, 3.5, 1.0, 7.0, 0.5, 7.5, 10.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
];

// Noisy observations from adaptive_scheduling.ipynb
// Subject 1: obs_seed=1001, Subject 2: obs_seed=2002 — matches run_adaptive() exactly.
// Weeks 1-7 (OBS_WEEKS=range(1,52)), NOTEBOOK_SNAPSHOT_WEEK=7.
// Values are in NORMALIZED units [0,1]; clinical display multiplies mal×5, uefm×66.
const S1_OBS_MAL_NORM  = [0.143031, 0.223970, 0.126810, 0.268432, 0.443952, 0.266334, 0.473901];
const S1_OBS_UEFM_NORM = [0.507816, 0.475251, 0.383717, 0.617904, 0.528750, 0.641746, 0.595417];
const S1_OBS_WMFT_NORM = [0.327714, 0.384846, 0.375491, 0.438549, 0.446194, 0.559789, 0.361775];

const S2_OBS_MAL_NORM  = [0.453460, 0.336045, 0.324735, 0.403816, 0.495853, 0.285995, 0.617767];
const S2_OBS_UEFM_NORM = [0.712689, 0.663706, 0.802434, 0.596065, 0.793784, 0.755354, 0.809002];
const S2_OBS_WMFT_NORM = [0.573599, 0.511863, 0.541386, 0.552696, 0.477170, 0.701330, 0.723930];

// Trajectories: index 0 = deterministic initial state, indices 1-7 = noisy notebook
// observations in clinical units, indices 8+ = deterministic forward simulation.
const _det1 = simulate(subject1Doses, PARAMS_S1);
const _det2 = simulate(subject2Doses, PARAMS_S2);

export const subject1Mal  = _det1.mal.map((v, i) => (i >= 1 && i <= 7) ? S1_OBS_MAL_NORM[i - 1] * 5.0   : v);
export const subject1Uefm = _det1.uefm.map((v, i) => (i >= 1 && i <= 7) ? S1_OBS_UEFM_NORM[i - 1] * 66.0 : v);
export const subject1Wmft = _det1.wmft.map((v, i) => (i >= 1 && i <= 7) ? S1_OBS_WMFT_NORM[i - 1]         : v);

export const subject2Mal  = _det2.mal.map((v, i) => (i >= 1 && i <= 7) ? S2_OBS_MAL_NORM[i - 1] * 5.0   : v);
export const subject2Uefm = _det2.uefm.map((v, i) => (i >= 1 && i <= 7) ? S2_OBS_UEFM_NORM[i - 1] * 66.0 : v);
export const subject2Wmft = _det2.wmft.map((v, i) => (i >= 1 && i <= 7) ? S2_OBS_WMFT_NORM[i - 1]         : v);

// ---------------------------------------------------------------------------
// Patient records
// ---------------------------------------------------------------------------

export const adaptiveNotebookPatients: Patient[] = [];

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
  const mal  = isSubject2 ? subject2Mal  : subject1Mal;
  const uefm = isSubject2 ? subject2Uefm : subject1Uefm;
  const wmft = isSubject2 ? subject2Wmft : subject1Wmft;
  const doses = isSubject2 ? subject2Doses : subject1Doses;
  // Week 0 is unobserved; NaN/null suppresses the dot while keeping array length
  // = week + 1 so the chart anchors the prediction start correctly.
  return {
    week,
    outcomes:    [NaN,  ...mal.slice(1, week + 1)],
    actions:     doses.slice(0, week + 1),
    observedMal:  [null, ...mal.slice(1, week + 1)],
    observedUefm: [null, ...uefm.slice(1, week + 1)],
    observedWmft: [null, ...wmft.slice(1, week + 1)],
  };
}

// ---------------------------------------------------------------------------
// Subject context — passed to the backend HMC endpoint for each demo patient
// ---------------------------------------------------------------------------

export interface SubjectContext {
  g: number;
  ageStd: number;
  conc: number;
}

// Subject 1: g=0, age 52, no concurrent therapy
export const SUBJ_CTX_S1: SubjectContext = {
  g: 0,
  ageStd: (52 - 18) / 75,
  conc: 0,
};

// Subject 2: g=1, age 60, concurrent therapy
export const SUBJ_CTX_S2: SubjectContext = {
  g: 1,
  ageStd: (60 - 18) / 75,
  conc: 1,
};
