"use client";

import Link from "next/link";
import PredictChart from "@/components/PredictChart";
import type { ChartData } from 'chart.js';
import { Patient } from "@/types/patient";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { useState, useEffect } from "react";

interface PatientPageProps {
  patient: Patient;
}

export default function PastPatientPage({ patient }: PatientPageProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setPatients(data); })
      .catch((error) => console.error("Error loading patients:", error));
  }, []);

  const currentPatientIndex = patients.findIndex(p => p.id === patient.id);
  const hasNextPatient = currentPatientIndex !== -1 && currentPatientIndex < patients.length - 1;
  const hasPreviousPatient = currentPatientIndex > 0;

  // Build chart datasets
  const outcomes    = patient.outcomes    ?? [];
  const actions     = patient.actions     ?? [];
  const observedMal = patient.observedMal ?? [];

  // Adaptive x-axis: end at the last week that has actual data
  const lastMalWeek  = observedMal.reduce<number>((max, v, i) => v !== null ? i : max, -1);
  const lastDoseWeek = actions.reduce((max, v, i) => v > 0 ? i : max, -1);
  const maxWeek = Math.max(lastMalWeek, lastDoseWeek, 0);

  const labels = Array.from({ length: maxWeek + 1 }, (_, i) => `Week ${i + 1}`);

  const scatterPoints = observedMal
    .map((v, i) => v !== null ? { x: i, y: v } : null)
    .filter((p): p is { x: number; y: number } => p !== null);

  const datasets: object[] = [
    {
      type: "line" as const,
      label: "Observed MAL",
      backgroundColor: "rgba(30, 90, 200, 0.1)",
      borderColor: "rgb(30, 90, 200)",
      pointBackgroundColor: "rgb(30, 90, 200)",
      pointRadius: 5,
      pointHoverRadius: 7,
      pointStyle: "circle",
      fill: false,
      tension: 0,
      yAxisID: "y-left",
      data: scatterPoints,
    },
    {
      type: "bar" as const,
      label: "Actual Treatment Hours",
      backgroundColor: "rgb(34, 139, 34)",
      borderColor: "white",
      yAxisID: "y-right",
      data: actions.slice(0, maxWeek + 1),
    },
  ];

  const chartData = { labels, datasets } as ChartData<"line" | "bar">;

  const totalDose = actions.reduce((a, b) => a + b, 0);
  const lastObserved = [...observedMal].reverse().find(v => v !== null) ?? null;
  const finalMAL = lastObserved !== null
    ? Math.round(lastObserved * 1000) / 1000
    : outcomes.length > 0
      ? Math.round(outcomes[outcomes.length - 1] * 1000) / 1000
      : 0;

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
            <p>Historical trial data. Blue line = observed MAL scores.</p>
          </div>

          <Link href="/patient">
            <Button variant="primary">← Back to Patients Dashboard</Button>
          </Link>
        </div>

        {/* Right Column */}
        <div className="w-full space-y-6 mt-8">
          <PredictChart data={chartData} />

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
