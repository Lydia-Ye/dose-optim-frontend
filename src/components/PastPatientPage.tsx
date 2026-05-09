"use client";

import Link from "next/link";
import PastPatientChart, { PlotRow, ObsRow } from "@/components/PastPatientChart";
import { Patient } from "@/types/patient";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { useState, useEffect } from "react";
import { PAST_PATIENT_DISPLAY_WEEKS } from "@/lib/pastPatientConstants";

interface PatientPageProps {
  patient: Patient;
}

interface SubjectPlotData {
  subject:  number;
  expgroup: number | null;
  uefm: { pred: PlotRow[]; obs: ObsRow[] };
  mal:  { pred: PlotRow[]; obs: ObsRow[] };
  wmft: { pred: PlotRow[]; obs: ObsRow[] };
}

const METRIC_CONFIG = {
  MAL:  { yLabel: "MAL Score",  yMax: 5  },
  UEFM: { yLabel: "UEFM Score", yMax: 66 },
  WMFT: { yLabel: "WMFT Score", yMax: 1  },
} as const;

export default function PastPatientPage({ patient }: PatientPageProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [metricTab, setMetricTab] = useState<"MAL" | "UEFM" | "WMFT">("MAL");
  const [plotData, setPlotData]   = useState<SubjectPlotData | null>(null);

  const actions      = patient.actions ?? [];
  const observedMal  = patient.observedMal ?? [];
  const outcomes     = patient.outcomes ?? [];

  // Fetch pre-computed plot data for this past patient
  useEffect(() => {
    if (!patient.sourceSubjectId) return;
    fetch(`/api/past-patient-plots/${patient.sourceSubjectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SubjectPlotData | null) => setPlotData(data))
      .catch(() => setPlotData(null));
  }, [patient.sourceSubjectId]);

  const totalDose    = actions.reduce((a, b) => a + b, 0);
  const lastObserved = [...observedMal].reverse().find(v => v !== null) ?? null;
  const finalMAL     = lastObserved !== null
    ? Math.round(lastObserved * 1000) / 1000
    : outcomes.length > 0 ? Math.round(outcomes[outcomes.length - 1] * 1000) / 1000 : 0;

  const modKey = metricTab.toLowerCase() as "mal" | "uefm" | "wmft";
  const { yLabel, yMax } = METRIC_CONFIG[metricTab];

  const predRows: PlotRow[] = (plotData?.[modKey]?.pred ?? [])
    .filter((row) => row.time <= PAST_PATIENT_DISPLAY_WEEKS);
  const obsRows:  ObsRow[]  = (plotData?.[modKey]?.obs  ?? [])
    .filter((row) => row.time <= PAST_PATIENT_DISPLAY_WEEKS);
  const hasData  = predRows.length > 0 || obsRows.length > 0;

  return (
    <>
      <main className="w-full max-w-screen-xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-10 items-start">

        {/* Left Column */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">Patient Detail</h2>
            <h1 className="text-4xl font-bold text-[var(--foreground)]">Patient {patient.name}</h1>
            <Badge variant="past">PAST</Badge>
          </div>

          <div className="text-sm text-gray-600 space-y-3">
            <p><strong>Total Treatment Hours:</strong> {Math.round(totalDose * 10) / 10} hrs</p>
            <p><strong>Final Observed MAL:</strong> {finalMAL} / 5</p>
            <p><strong>Horizon:</strong> {patient.horizon} weeks</p>
          </div>

          <Button className="w-56" variant="secondary" onClick={() => setShowInfoModal(true)}>
            Patient Info
          </Button>

          <div className="border-t border-[var(--color-border)] pt-4 text-sm text-gray-500">
            <p>Historical trial data. Use the tabs to compare observed outcome scores.</p>
          </div>

          <Link href="/patient">
            <Button variant="primary">← Back to Patients Dashboard</Button>
          </Link>
        </div>

        {/* Right Column */}
        <div className="w-full space-y-6 mt-8">
          {/* Metric tabs */}
          <div className="flex">
            <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
              {(["MAL", "UEFM", "WMFT"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetricTab(m)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    metricTab === m
                      ? "bg-white text-[var(--color-primary)] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {plotData === null && patient.sourceSubjectId ? (
            <p className="text-sm text-gray-400 text-center py-24">Loading plot data…</p>
          ) : hasData ? (
            <PastPatientChart
              predRows={predRows}
              obsRows={obsRows}
              doseData={actions.slice(0, PAST_PATIENT_DISPLAY_WEEKS)}
              metric={metricTab}
              yLabel={yLabel}
              yMax={yMax}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-24">
              No {metricTab} data available for this patient.
            </p>
          )}
        </div>

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-[rgba(0,0,0,0.2)] flex items-center justify-center z-50">
            <div
              className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-4">Patient Information</h3>
              <div className="text-left space-y-2 mb-6">
                <p><strong>Name:</strong> {patient.name}</p>
                {patient.age !== undefined && <p><strong>Age (approx):</strong> {patient.age}</p>}
                {patient.weeksSinceStroke !== undefined && (
                  <p><strong>Weeks Since Stroke:</strong> {patient.weeksSinceStroke}</p>
                )}
                <p><strong>Total Treatment Hours:</strong> {Math.round(totalDose * 10) / 10} hrs</p>
                <p><strong>Final Observed MAL:</strong> {finalMAL} / 5</p>
                <p><strong>Horizon:</strong> {patient.horizon} weeks</p>
              </div>
              <Button type="button" variant="danger" onClick={() => setShowInfoModal(false)} className="w-32">
                Close
              </Button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
