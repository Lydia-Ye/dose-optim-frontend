"use client";

import Link from "next/link";
import PredictChart from "@/components/PredictChart";
import ManualScheduleForm from "@/components/ManualScheduleForm";
import ModelDetailPanels from "@/components/ModelDetailPanels";
import { Patient } from "@/types/patient";
import { BandData } from "@/components/BandChart";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { useState, useEffect } from "react";

interface PatientPageProps {
  patient: Patient;
}

interface Prediction {
  mean: number[];
  min: number[];
  max: number[];
  dosage: number[];
  malSmooth?:  BandData;
  uefmSmooth?: BandData;
  wmftSmooth?: BandData;
  mal?:        BandData;
  uefm?:       BandData;
  wmft?:       BandData;
  s?:          BandData;
  rM?:         BandData;
}

export default function PastPatientPage({ patient }: PatientPageProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const [manualPrediction, setManualPrediction] = useState<Prediction | null>(null);
  const [activeTab, setActiveTab] = useState<"timeline" | "detail">("timeline");

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setPatients(data); })
      .catch((error) => console.error("Error loading patients:", error));
  }, []);

  const currentPatientIndex = patients.findIndex(p => p.id === patient.id);
  const hasNextPatient = currentPatientIndex !== -1 && currentPatientIndex < patients.length - 1;
  const hasPreviousPatient = currentPatientIndex > 0;

  const handleManualSchedule = async (futureActions: number[]) => {
    try {
      const res = await fetch("/api/manual-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: patient.id, future_actions: futureActions }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Manual prediction failed (${res.status})`);
      }
      const data = await res.json();
      setManualPrediction({
        mean:   data.meanPrediction,
        min:    data.minPrediction,
        max:    data.maxPrediction,
        dosage: futureActions,
        malSmooth:  data.malSmooth,
        uefmSmooth: data.uefmSmooth,
        wmftSmooth: data.wmftSmooth,
        mal:        data.mal,
        uefm:       data.uefm,
        wmft:       data.wmft,
        s:          data.s,
        rM:         data.rM,
      });
      setActiveTab("detail");
    } catch (err) {
      console.error(err);
    }
  };

  // Build chart datasets
  const outcomes = patient.outcomes ?? [];
  const actions  = patient.actions  ?? [];
  const labels = outcomes.map((_, i) => `Week ${i + 1}`);

  const datasets: object[] = [
    {
      type: "line" as const,
      label: "Model Prediction (Actual Schedule)",
      backgroundColor: "rgb(65, 105, 225)",
      borderColor: "rgb(65, 105, 225)",
      pointRadius: 0,
      pointHoverRadius: 4,
      yAxisID: "y-left",
      borderDash: [],
      data: outcomes,
    },
    {
      type: "bar" as const,
      label: "Actual Treatment Hours",
      backgroundColor: "rgba(58, 218, 55, 0.5)",
      borderColor: "white",
      yAxisID: "y-right",
      data: actions,
    },
  ];

  if (manualPrediction) {
    datasets.push({
      type: "line" as const,
      label: "Model Prediction (Manual Schedule)",
      backgroundColor: "rgb(160, 80, 220)",
      borderColor: "rgb(160, 80, 220)",
      pointRadius: 0,
      pointHoverRadius: 4,
      yAxisID: "y-left",
      borderDash: [4, 4],
      data: manualPrediction.mean,
    });
  }

  const chartData = { labels, datasets };

  const totalDose = actions.reduce((a, b) => a + b, 0);
  const finalMAL = outcomes.length > 0
    ? Math.round(outcomes[outcomes.length - 1] * 1000) / 1000
    : 0;

  return (
    <>
      {showManualForm && (
        <div
          className="fixed inset-0 bg-[rgba(0,0,0,0.2)] flex items-center justify-center z-50"
          onClick={() => setShowManualForm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-lg p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ManualScheduleForm
              readonlyOutcomes={outcomes.slice(0, 1)}
              readonlyActions={[]}
              onSubmit={handleManualSchedule}
              setShowForm={setShowManualForm}
              maxDose={patient.maxDose}
              horizon={patient.horizon}
              budget={patient.budget}
              onClose={() => setShowManualForm(false)}
            />
          </div>
        </div>
      )}

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
            <p><strong>Final Predicted MAL:</strong> {finalMAL} / 5</p>
            <p><strong>Horizon:</strong> {patient.horizon} weeks</p>
          </div>

          <Button
            className="w-56"
            variant="secondary"
            onClick={() => setShowInfoModal(true)}
          >
            Patient Info
          </Button>

          {/* Model controls */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-blue-600">Run Model</h2>

            <Button
              className="w-56"
              variant="secondary"
              onClick={() => setShowManualForm(true)}
            >
              Manual Schedule
            </Button>

            {manualPrediction && (
              <Button
                className="w-56"
                variant="danger"
                onClick={() => setManualPrediction(null)}
              >
                Clear Prediction
              </Button>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] pt-4 text-sm text-gray-500">
            <p>Historical trial data. Blue line = model prediction using actual doses. Enter a manual schedule to compare outcomes.</p>
          </div>

          <Link href="/patient">
            <Button variant="primary">← Back to Patients Dashboard</Button>
          </Link>
        </div>

        {/* Right Column */}
        <div className="w-full space-y-6">
          {/* Tab Bar */}
          <div className="flex border-b border-[var(--color-border)]">
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "timeline"
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-gray-500 hover:text-[var(--foreground)] hover:border-gray-300"
              }`}
            >
              Treatment Timeline
            </button>
            {manualPrediction?.mal && (
              <button
                onClick={() => setActiveTab("detail")}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "detail"
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-gray-500 hover:text-[var(--foreground)] hover:border-gray-300"
                }`}
              >
                Model Prediction Detail
              </button>
            )}
          </div>

          {activeTab === "timeline" && (
            <PredictChart data={chartData} />
          )}

          {activeTab === "detail" &&
           manualPrediction?.mal && manualPrediction.malSmooth &&
           manualPrediction.uefm && manualPrediction.uefmSmooth &&
           manualPrediction.wmft && manualPrediction.wmftSmooth &&
           manualPrediction.s && manualPrediction.rM && (
            <ModelDetailPanels
              mal={manualPrediction.mal}
              malSmooth={manualPrediction.malSmooth}
              uefm={manualPrediction.uefm}
              uefmSmooth={manualPrediction.uefmSmooth}
              wmft={manualPrediction.wmft}
              wmftSmooth={manualPrediction.wmftSmooth}
              s={manualPrediction.s}
              rM={manualPrediction.rM}
              dosage={manualPrediction.dosage}
            />
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center">
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
          </div>
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
                <p><strong>Final Predicted MAL:</strong> {finalMAL} / 5</p>
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
