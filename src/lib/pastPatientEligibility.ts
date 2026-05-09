import fs from "fs";
import path from "path";
import { PAST_PATIENT_DISPLAY_WEEKS } from "@/lib/pastPatientConstants";

type ObsRow = {
  time?: number;
  obs_val?: number | null;
};

type SubjectPlotData = {
  mal?: { obs?: ObsRow[] };
  uefm?: { obs?: ObsRow[] };
  wmft?: { obs?: ObsRow[] };
};

const PAST_PATIENT_PLOT_DIR = path.join(
  process.cwd(),
  "src/app/api/data/past-patient-plots",
);

function hasObservationBeforeWeek52(rows: ObsRow[] | undefined): boolean {
  return (rows ?? []).some((row) => (
    typeof row.time === "number" &&
    row.time < PAST_PATIENT_DISPLAY_WEEKS &&
    row.obs_val !== null &&
    row.obs_val !== undefined
  ));
}

export function hasAllMetricObservationsBeforeWeek52(
  sourceSubjectId: number | null | undefined,
): boolean {
  if (sourceSubjectId == null) return false;

  const filePath = path.join(PAST_PATIENT_PLOT_DIR, `${sourceSubjectId}.json`);
  if (!fs.existsSync(filePath)) return false;

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as SubjectPlotData;
    return (
      hasObservationBeforeWeek52(data.mal?.obs) &&
      hasObservationBeforeWeek52(data.uefm?.obs) &&
      hasObservationBeforeWeek52(data.wmft?.obs)
    );
  } catch {
    return false;
  }
}
