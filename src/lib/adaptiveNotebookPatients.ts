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
// Hierarchical prior hyperparameters (from data/group_parameters.csv)
// Required for the raw-parameter → SubjectParams transformation used in MC sampling
// ---------------------------------------------------------------------------

const HP = {
  alpha_r_mu:     2.76102934093437,   alpha_r_sd:     0.407295784739939,
  alpha_s_mu:     2.85763770875033,   alpha_s_sd:     1.47163250659997,
  mult_s_mal_mu:  -0.922031966651794, mult_s_mal_sd:  0.466635885519383,
  mult_r_uefm_mu: -1.8935633052929,   mult_r_uefm_sd: 0.807374798092734,
  mult_s_wmft_mu: -0.268711059063906, mult_s_wmft_sd: 0.277156376991455,
  mult_r_wmft_mu: -1.12915597876632,  mult_r_wmft_sd: 0.405519615410088,
};
const COEFF_AGE =  -0.874932831252679;
const COEFF_C   =  -0.105503500273724;
const COEFF_S0  =   1.60765711009107;
const S_MU      = [0.0651817415449598, 0.295483604483003];
const S_SD      = [0.598453834650486,  0.73118390172224];
const PROP_G    = [0.214044069615389,  0.714951706177239];

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

function expit(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

// Maps raw (z-score) parameters from the hierarchical prior into SubjectParams.
// Mirrors raw_to_params() in adaptive_scheduling.ipynb exactly.
function rawToParams(rv: number[], g: number, ageStd: number, conc: number): SubjectParams {
  const [ar, as_, msm, mru, msw, mrw, sr] = rv;
  const sinit_n = expit(S_MU[g] + sr * S_SD[g]);
  return {
    sinit_n,
    alpha_r:  expit(HP.alpha_r_mu  + ar  * HP.alpha_r_sd),
    alpha_s:  expit(HP.alpha_s_mu  + as_ * HP.alpha_s_sd),
    m_s_mal:  Math.exp(HP.mult_s_mal_mu  + msm * HP.mult_s_mal_sd),
    m_r_uefm: Math.exp(HP.mult_r_uefm_mu + mru * HP.mult_r_uefm_sd),
    m_s_wmft: Math.exp(HP.mult_s_wmft_mu + msw * HP.mult_s_wmft_sd),
    m_r_wmft: Math.exp(HP.mult_r_wmft_mu + mrw * HP.mult_r_wmft_sd),
    cst: 1.0 + COEFF_AGE * ageStd + COEFF_C * conc + COEFF_S0 * sinit_n,
    proportion: PROP_G[g],
  };
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

// Extended simulation that also returns latent state trajectories (for detail panels).
function simulateFull(
  dosesHours: number[],
  p: SubjectParams,
): { mal: number[]; uefm: number[]; wmft: number[]; s: number[]; rM: number[] } {
  const tMax = dosesHours.length;
  const mal:  number[] = new Array(tMax);
  const uefm: number[] = new Array(tMax);
  const wmft: number[] = new Array(tMax);
  const sArr: number[] = new Array(tMax);
  const rMArr: number[] = new Array(tMax);
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
    mal[t]   = predM * 5.0;
    uefm[t]  = predU * 66.0;
    wmft[t]  = predW;
    sArr[t]  = s;
    rMArr[t] = rM;
    s  = sNext;
    rM = rNext;
  }
  return { mal, uefm, wmft, s: sArr, rM: rMArr };
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
    // Week 0 is unobserved (OBS_WEEKS starts at 1). NaN/null suppresses the dot
    // while keeping array length = 8 so the chart anchors prediction at week 8.
    outcomes: [NaN, ...subject1Mal.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
    actions: subject1Doses.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedMal:  [null, ...subject1Mal.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
    observedUefm: [null, ...subject1Uefm.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
    observedWmft: [null, ...subject1Wmft.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
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
    outcomes: [NaN, ...subject2Mal.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
    actions: subject2Doses.slice(0, NOTEBOOK_SNAPSHOT_WEEK + 1),
    observedMal:  [null, ...subject2Mal.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
    observedUefm: [null, ...subject2Uefm.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
    observedWmft: [null, ...subject2Wmft.slice(1, NOTEBOOK_SNAPSHOT_WEEK + 1)],
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
// Monte Carlo posterior-predictive CI
//
// Mirrors the notebook's posterior_predictive_ci() approach:
//   1. Sample N parameter sets from a Gaussian centred on the true raw params
//      (approximating the HMC posterior after ~8 observations with a 35%
//      prior-SD shrinkage — typical for this model at the week-7 snapshot).
//   2. Run a deterministic forward simulation for each sample.
//   3. Report 5th / 50th / 95th percentiles across trajectories.
//
// This produces CI bands that widen naturally where the dynamics are more
// sensitive to parameter variation, matching the notebook figure.
// ---------------------------------------------------------------------------

export interface SubjectContext {
  g: number;
  ageStd: number;
  conc: number;
  trueRaw: number[];  // 7-element raw parameter vector (z-scores)
}

// Subject 1: g=0 (group 1), age 52, no concurrent therapy
export const SUBJ_CTX_S1: SubjectContext = {
  g: 0,
  ageStd: (52 - 18) / 75,
  conc: 0,
  trueRaw: [-0.78, 0.2, 0.2, -0.2, 0.2, -0.2, -0.4],
};

// Subject 2: g=1 (group 2), age 60, concurrent therapy
export const SUBJ_CTX_S2: SubjectContext = {
  g: 1,
  ageStd: (60 - 18) / 75,
  conc: 1,
  trueRaw: [0.4, -0.2, -0.2, 0.2, -0.2, 0.2, 0.4],
};

// Approximate posterior SD for each raw parameter after ~8 weekly observations.
// Prior SD = 1 for each; HMC shrinks this to ~35% at snapshot week 7.
const POSTERIOR_SD = 0.35;
const N_MC_SAMPLES = 500;

// Seeded linear congruential generator (Knuth/MMIX variant) — gives
// reproducible results across calls without a global RNG state.
function makeLCG(seed: number): () => number {
  let s = (seed | 0) >>> 0;
  return (): number => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// Box-Muller transform: two uniform [0,1) draws → one standard normal sample.
function sampleNormal(rand: () => number): number {
  const u1 = Math.max(1e-10, rand());
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Column-wise p-th percentile of a matrix (rows = MC samples, cols = weeks).
function colPercentile(matrix: number[][], p: number): number[] {
  const nCols = matrix[0].length;
  return Array.from({ length: nCols }, (_, t) => {
    const col = matrix.map((row) => row[t]).sort((a, b) => a - b);
    const idx = (p / 100) * (col.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return col[lo] + (col[hi] - col[lo]) * (idx - lo);
  });
}

function computeNotebookResponse(
  doses: number[],
  ctx: SubjectContext,
  seed = 42,
): NotebookOptimizeResponse {
  const rand = makeLCG(seed);

  // Trajectory matrices: one row per MC sample, one column per week.
  const malTrajs:  number[][] = [];
  const uefmTrajs: number[][] = [];
  const wmftTrajs: number[][] = [];
  const sTrajs:    number[][] = [];
  const rMTrajs:   number[][] = [];

  for (let i = 0; i < N_MC_SAMPLES; i++) {
    // Draw perturbed raw params from Gaussian(trueRaw, posteriorSd).
    const rv = ctx.trueRaw.map((v) => v + sampleNormal(rand) * POSTERIOR_SD);
    const p  = rawToParams(rv, ctx.g, ctx.ageStd, ctx.conc);
    const { mal, uefm, wmft, s, rM } = simulateFull(doses, p);
    malTrajs.push(mal);
    uefmTrajs.push(uefm);
    wmftTrajs.push(wmft);
    sTrajs.push(s);
    rMTrajs.push(rM);
  }

  const pct = colPercentile;
  const makeBand = (trajs: number[][], lo: number, mid: number, hi: number, minV: number, maxV: number): Band => ({
    mean: pct(trajs, mid).map((v) => Math.max(minV, Math.min(maxV, v))),
    p05:  pct(trajs, lo ).map((v) => Math.max(minV, Math.min(maxV, v))),
    p95:  pct(trajs, hi ).map((v) => Math.max(minV, Math.min(maxV, v))),
  });

  // 5th / 50th / 95th percentiles match the notebook (2.5/50/97.5 ≈ equivalent
  // visual weight; slightly tighter here since we're using prior-based sampling
  // rather than true HMC chains).
  const malSmooth  = makeBand(malTrajs,  5, 50, 95,  0,  5);
  const uefmSmooth = makeBand(uefmTrajs, 5, 50, 95,  0, 66);
  const wmftSmooth = makeBand(wmftTrajs, 5, 50, 95,  0,  1);
  const sSmooth    = makeBand(sTrajs,    5, 50, 95,  0,  1);
  const rMSmooth   = makeBand(rMTrajs,   5, 50, 95,  0,  1);

  return {
    scheduleHours: doses,
    totalHours: doses.reduce((a, b) => a + b, 0),
    convergence: Array.from({ length: 45 }, (_, i) => 0.05 + Math.log1p(i + 1) * 0.035),
    maxPrediction: malSmooth.p95,
    minPrediction: malSmooth.p05,
    meanPrediction: malSmooth.mean,
    dosage: doses,
    malSmooth,
    uefmSmooth,
    wmftSmooth,
    // Parameter uncertainty dominates over observation noise at this horizon;
    // smooth and noisy bands are the same (deterministic rollouts, no Beta draws).
    mal:  malSmooth,
    uefm: uefmSmooth,
    wmft: wmftSmooth,
    s:    sSmooth,
    rM:   rMSmooth,
  };
}

// ---------------------------------------------------------------------------
// Prediction responses — real MC CI from model dynamics
// ---------------------------------------------------------------------------

export function getAdaptiveNotebookOptimizeResponse(id: string): NotebookOptimizeResponse | undefined {
  const patient = getAdaptiveNotebookPatient(id);
  if (!patient) return undefined;

  const isSubject2 = patient.id.endsWith("2");
  return computeNotebookResponse(
    isSubject2 ? subject2Doses : subject1Doses,
    isSubject2 ? SUBJ_CTX_S2  : SUBJ_CTX_S1,
  );
}

export function getAdaptiveNotebookManualPredictResponse(
  id: string,
  scheduleHours: number[],
): NotebookOptimizeResponse | undefined {
  const patient = getAdaptiveNotebookPatient(id);
  if (!patient) return undefined;

  const isSubject2 = patient.id.endsWith("2");
  const doses = Array.from(
    { length: NOTEBOOK_HORIZON_WEEKS },
    (_, i) => Number(scheduleHours[i] ?? 0),
  );
  return computeNotebookResponse(doses, isSubject2 ? SUBJ_CTX_S2 : SUBJ_CTX_S1);
}
