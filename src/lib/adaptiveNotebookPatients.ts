import { Patient } from "@/types/patient";

type Band = { mean: number[]; p05: number[]; p95: number[] };
export type NotebookSnapshotWeek = 1 | 7 | 13;

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
const NOTEBOOK_SNAPSHOT_WEEK = 13;

function band(mean: number[], width: number, min = 0, max = Number.POSITIVE_INFINITY): Band {
  return {
    mean,
    p05: mean.map((value) => Math.max(min, value - width)),
    p95: mean.map((value) => Math.min(max, value + width)),
  };
}

// Plateau extension helper: continue from lastVal, approaching cap over extLen weeks.
function plateau(lastVal: number, cap: number, extLen: number): number[] {
  return Array.from({ length: extLen }, (_, i) =>
    Math.min(cap, lastVal + (cap - lastVal) * (1 - Math.exp(-i / 12))),
  ).map((v) => Math.round(v * 1000) / 1000);
}

const subject1Mal = [
  1.45, 1.55, 1.64, 1.83, 2.11, 2.34, 2.57, 2.78, 2.94, 3.05, 3.15,
  3.20, 3.23, 3.26, 3.29, 3.31, 3.33, 3.35, 3.36, 3.37, 3.38,
  ...plateau(3.38, 3.45, 31),
];

const subject2Mal = [
  2.02, 2.11, 2.24, 2.42, 2.68, 2.92, 3.15, 3.36, 3.52, 3.68, 3.81,
  3.91, 4.00, 4.07, 4.13, 4.18, 4.22, 4.25, 4.28, 4.30, 4.32,
  ...plateau(4.32, 4.40, 31),
];

const subject1Uefm = [
  30.133, 30.491, 30.874, 31.347, 32.45, 33.402, 33.915, 34.702, 35.514,
  36.192, 36.88, 37.404, 37.452, 37.428, 37.601, 37.605, 37.666, 37.645,
  37.676, 37.683, 37.67,
  ...plateau(37.67, 38.0, 31),
];

const subject2Uefm = [
  42.432, 43.707, 44.955, 46.424, 47.839, 49.748, 51.228, 53.145, 54.837,
  56.314, 57.784, 58.932, 60.128, 60.491, 60.912, 61.161, 61.386, 61.588,
  61.77, 61.965, 62.11,
  ...plateau(62.11, 62.5, 31),
];

const subject1Wmft = [
  0.369, 0.374, 0.381, 0.391, 0.423, 0.451, 0.463, 0.485, 0.508, 0.527,
  0.546, 0.56, 0.557, 0.552, 0.554, 0.55, 0.548, 0.544, 0.541, 0.538, 0.534,
  ...plateau(0.534, 0.55, 31),
];

const subject2Wmft = [
  0.465, 0.48, 0.496, 0.521, 0.545, 0.585, 0.614, 0.656, 0.694, 0.725,
  0.758, 0.781, 0.807, 0.809, 0.813, 0.813, 0.812, 0.811, 0.81, 0.811, 0.81,
  ...plateau(0.81, 0.83, 31),
];

const subject1Doses = [
  0, 0.5, 1.5, 7.5, 6.5, 3, 6, 7, 6.5, 7.5, 6.5,
  1, 0, 3, 0.5, 1.5, 0, 1, 0.5, 0, 0,
  ...new Array(31).fill(0),
];

const subject2Doses = [
  0, 0.5, 2.5, 2.5, 6, 4, 7.5, 7, 6.5, 7.5, 6,
  7.5, 0.5, 1.5, 0, 0, 0, 0, 0.5, 0, 0,
  ...new Array(31).fill(0),
];

export const adaptiveNotebookPatients: Patient[] = [
  {
    id: "adaptive-notebook-1",
    sourceSubjectId: null,
    displayId: "376",
    name: "376",
    past: false,
    budget: 60,
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
    budget: 60,
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
    outcomes: (isSubject2 ? subject2Mal : subject1Mal).slice(0, end),
    actions: (isSubject2 ? subject2Doses : subject1Doses).slice(0, end),
    observedMal: (isSubject2 ? subject2Mal : subject1Mal).slice(0, end),
    observedUefm: (isSubject2 ? subject2Uefm : subject1Uefm).slice(0, end),
    observedWmft: (isSubject2 ? subject2Wmft : subject1Wmft).slice(0, end),
  };
}

export function getAdaptiveNotebookOptimizeResponse(id: string): NotebookOptimizeResponse | undefined {
  const patient = getAdaptiveNotebookPatient(id);
  if (!patient) return undefined;

  const isSubject2 = patient.id.endsWith("2");
  const meanPrediction = isSubject2 ? subject2Mal : subject1Mal;
  const scheduleHours = isSubject2 ? subject2Doses : subject1Doses;
  const uefmPrediction = isSubject2 ? subject2Uefm : subject1Uefm;
  const wmftPrediction = isSubject2 ? subject2Wmft : subject1Wmft;
  return buildNotebookResponse(id, meanPrediction, scheduleHours, uefmPrediction, wmftPrediction);
}

export function getAdaptiveNotebookManualPredictResponse(
  id: string,
  scheduleHours: number[],
): NotebookOptimizeResponse | undefined {
  const patient = getAdaptiveNotebookPatient(id);
  if (!patient) return undefined;

  const isSubject2 = patient.id.endsWith("2");
  const baseMean = isSubject2 ? subject2Mal : subject1Mal;
  const baseSchedule = isSubject2 ? subject2Doses : subject1Doses;
  const baseUefm = isSubject2 ? subject2Uefm : subject1Uefm;
  const baseWmft = isSubject2 ? subject2Wmft : subject1Wmft;
  const normalizedSchedule = Array.from(
    { length: NOTEBOOK_HORIZON_WEEKS },
    (_, index) => Number(scheduleHours[index] ?? 0),
  );

  // After the dose horizon, treatment effect decays exponentially (half-life ~13 weeks).
  const DECAY_RATE = Math.log(2) / 13;
  const effectDecay = (index: number) => {
    const weeksAfter = index - (NOTEBOOK_DOSE_HORIZON_WEEKS - 1);
    return weeksAfter <= 0 ? 1 : Math.exp(-DECAY_RATE * weeksAfter);
  };

  let cumulativeDelta = 0;
  const meanPrediction = baseMean.map((value, index) => {
    if (index < NOTEBOOK_DOSE_HORIZON_WEEKS) {
      cumulativeDelta += (normalizedSchedule[index] ?? 0) - (baseSchedule[index] ?? 0);
    }
    return Math.max(0, Math.min(5, value + cumulativeDelta * 0.06 * effectDecay(index)));
  });

  cumulativeDelta = 0;
  const uefmPrediction = baseUefm.map((value, index) => {
    if (index < NOTEBOOK_DOSE_HORIZON_WEEKS) {
      cumulativeDelta += (normalizedSchedule[index] ?? 0) - (baseSchedule[index] ?? 0);
    }
    return Math.max(0, Math.min(66, value + cumulativeDelta * 0.45 * effectDecay(index)));
  });

  cumulativeDelta = 0;
  const wmftPrediction = baseWmft.map((value, index) => {
    if (index < NOTEBOOK_DOSE_HORIZON_WEEKS) {
      cumulativeDelta += (normalizedSchedule[index] ?? 0) - (baseSchedule[index] ?? 0);
    }
    return Math.max(0, Math.min(1, value + cumulativeDelta * 0.006 * effectDecay(index)));
  });

  return buildNotebookResponse(id, meanPrediction, normalizedSchedule, uefmPrediction, wmftPrediction);
}

function buildNotebookResponse(
  id: string,
  meanPrediction: number[],
  scheduleHours: number[],
  uefmPrediction?: number[],
  wmftPrediction?: number[],
): NotebookOptimizeResponse {
  const uefmMean = uefmPrediction ?? meanPrediction.map((value) => Math.min(66, 20 + value * 8.2));
  const wmftMean = wmftPrediction ?? meanPrediction.map((value) => Math.min(1, 0.24 + value * 0.11));
  const sMean = meanPrediction.map((value) => Math.min(1, 0.18 + value * 0.095));
  const rMean = meanPrediction.map((value, index) => Math.min(1, 0.02 + value * 0.045 + index * 0.006));

  const malSmooth = band(meanPrediction, 0.28, 0, 5);
  return {
    scheduleHours,
    totalHours: scheduleHours.reduce((sum, hours) => sum + hours, 0),
    convergence: Array.from({ length: 45 }, (_, index) => 0.05 + Math.log1p(index + 1) * 0.035),
    maxPrediction: malSmooth.p95,
    minPrediction: malSmooth.p05,
    meanPrediction: malSmooth.mean,
    dosage: scheduleHours,
    malSmooth,
    uefmSmooth: band(uefmMean, 3.2, 0, 66),
    wmftSmooth: band(wmftMean, 0.07, 0, 1),
    mal: band(meanPrediction, 0.45, 0, 5),
    uefm: band(uefmMean, 5.5, 0, 66),
    wmft: band(wmftMean, 0.11, 0, 1),
    s: band(sMean, 0.05, 0, 1),
    rM: band(rMean, 0.06, 0, 1),
  };
}
