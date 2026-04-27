"use client";

import Link from "next/link";
import CurrentPredictChart from "@/components/CurrentPredictChart";
import { Patient } from "@/types/patient";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { useState } from "react";

interface PatientPageProps {
  patient: Patient;
}

export default function PastPatientPage({ patient }: PatientPageProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [metricTab, setMetricTab] = useState<"MAL" | "UEFM" | "WMFT">("MAL");

  const actions = patient.actions ?? [];
  const observedMal = patient.observedMal ?? [];
  const observedUefm = patient.observedUefm ?? [];
  const observedWmft = patient.observedWmft ?? [];
  const outcomes = patient.outcomes ?? [];

  // Adaptive x-axis: end at the last week that has actual data
  const lastMalWeek = observedMal.reduce<number>((max, v, i) => v !== null ? i : max, -1);
  const lastUefmWeek = observedUefm.reduce<number>((max, v, i) => v !== null ? i : max, -1);
  const lastWmftWeek = observedWmft.reduce<number>((max, v, i) => v !== null ? i : max, -1);
  const lastDoseWeek = actions.reduce((max, v, i) => v > 0 ? i : max, -1);
  const maxWeek = Math.max(lastMalWeek, lastUefmWeek, lastWmftWeek, lastDoseWeek, 0);

  const totalDose = actions.reduce((a, b) => a + b, 0);
  const lastObserved = [...observedMal].reverse().find(v => v !== null) ?? null;
  const finalMAL = lastObserved !== null
    ? Math.round(lastObserved * 1000) / 1000
    : outcomes.length > 0
      ? Math.round(outcomes[outcomes.length - 1] * 1000) / 1000
      : 0;
  const emptyPrediction = { maxOut: [], futureAvgOut: [], minOut: [], futureDoseData: [] };
  const metricData = {
    MAL: {
      values: observedMal,
      yLabel: "MAL Score",
      yMax: 5,
    },
    UEFM: {
      values: observedUefm,
      yLabel: "UEFM Score",
      yMax: 66,
    },
    WMFT: {
      values: observedWmft,
      yLabel: "WMFT Score",
      yMax: 1,
    },
  }[metricTab];
  const hasMetricData = metricData.values.some(v => v !== null);
  const doseBarThickness = maxWeek > 60 ? 5 : undefined;

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

          <Button
            className="w-56"
            variant="secondary"
            onClick={() => setShowInfoModal(true)}
          >
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

          {hasMetricData ? (
            <CurrentPredictChart
              pastAvgOut={metricData.values.slice(0, maxWeek + 1)}
              pastDoseData={actions.slice(0, maxWeek + 1)}
              manualPrediction={emptyPrediction}
              horizon={maxWeek + 1}
              yLabel={metricData.yLabel}
              yMax={metricData.yMax}
              doseBarPercentage={0.9}
              doseBarThickness={doseBarThickness}
            />
          ) : (
            <p className="text-sm text-gray-400 text-center py-24">
              No observed {metricTab} data is available for this patient.
            </p>
          )}

          {/* Previous/Next Patient Navigation */}
          {/* <div className="flex justify-between items-center">
            {hasPreviousPatient ? (
              <Link href={`/patient/${patients[currentPatientIndex - 1].id}`}>
                <Button variant="outline">← Previous Patient</Button>
              </Link>
            ) : <div />}

            {hasNextPatient ? (
              <Link href={`/patient/${patients[currentPatientIndex + 1].id}`}>
                <Button variant="outline">Next Patient →</Button>
              </Link>
            ) : <div />}
          </div> */}
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
                {patient.weeksSinceStroke !== undefined && <p><strong>Weeks Since Stroke:</strong> {patient.weeksSinceStroke}</p>}
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
