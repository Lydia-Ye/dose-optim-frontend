"use client";

import Link from "next/link";
import PredictChart from "@/components/PredictChart";
import ManualScheduleForm from "@/components/ManualScheduleForm";
import { Patient } from "@/types/patient";
import Badge from "./ui/Badge";
import Button from "./ui/Button";
import { useState, useEffect } from "react";
import { ResultsPostResponse } from "@/types/resultsPostResponse";

interface PatientPageProps {
  patient: Patient;
}

interface Prediction {
  mean: number[];
  min: number[];
  max: number[];
  dosage: number[];
}

export default function PastPatientPage({ patient }: PatientPageProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const [optimizedPrediction, setOptimizedPrediction] = useState<Prediction | null>(null);
  const [manualPrediction, setManualPrediction] = useState<Prediction | null>(null);
  const [loadingOptimize, setLoadingOptimize] = useState(false);

  useEffect(() => {
    fetch("/api/patients")
      .then((res) => res.json())
      .then((data) => setPatients(data))
      .catch((error) => console.error("Error loading patients:", error));
  }, []);

  const currentPatientIndex = patients.findIndex(p => p.id === patient.id);
  const hasNextPatient = currentPatientIndex !== -1 && currentPatientIndex < patients.length - 1;
  const hasPreviousPatient = currentPatientIndex > 0;

  const handleOptimize = async () => {
    setLoadingOptimize(true);
    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: patient.id,
          alias: patient.id,
          budget: patient.budget,
          horizon: patient.horizon,
        }),
      });
      if (!res.ok) throw new Error("Optimize failed");
      const data: ResultsPostResponse = await res.json();
      setOptimizedPrediction({
        mean: data.meanOutcome,
        min: data.minOutcome,
        max: data.maxOutcome,
        dosage: data.dosage,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingOptimize(false);
    }
  };

  const handleManualSchedule = async (futureActions: number[]) => {
    try {
      const res = await fetch("/api/manual-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: patient.id, future_actions: futureActions }),
      });
      if (!res.ok) throw new Error("Manual predict failed");
      const data = await res.json();
      setManualPrediction({
        mean: data.meanPrediction,
        min: data.minPrediction,
        max: data.maxPrediction,
        dosage: futureActions,
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Build chart datasets
  const labels = patient.outcomes.map((_, i) => `Week ${i + 1}`);

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
      data: patient.outcomes,
    },
    {
      type: "bar" as const,
      label: "Actual Treatment Hours",
      backgroundColor: "rgba(58, 218, 55, 0.5)",
      borderColor: "white",
      yAxisID: "y-right",
      data: patient.actions,
    },
  ];

  if (optimizedPrediction) {
    datasets.push(
      {
        type: "line" as const,
        label: "Model Prediction (Optimal Schedule)",
        backgroundColor: "rgb(220, 80, 60)",
        borderColor: "rgb(220, 80, 60)",
        pointRadius: 0,
        pointHoverRadius: 4,
        yAxisID: "y-left",
        borderDash: [6, 3],
        data: optimizedPrediction.mean,
      },
      {
        type: "bar" as const,
        label: "Optimal Treatment Hours",
        backgroundColor: "rgba(220, 80, 60, 0.3)",
        borderColor: "transparent",
        yAxisID: "y-right",
        data: optimizedPrediction.dosage,
      }
    );
  }

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

  const totalDose = patient.actions.reduce((a, b) => a + b, 0);
  const finalMAL = patient.outcomes.length > 0
    ? Math.round(patient.outcomes[patient.outcomes.length - 1] * 1000) / 1000
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
              readonlyOutcomes={patient.outcomes.slice(0, 1)}
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
              onClick={handleOptimize}
              disabled={loadingOptimize}
            >
              {loadingOptimize ? "Optimizing…" : "Optimal Schedule"}
            </Button>

            <Button
              className="w-56"
              variant="secondary"
              onClick={() => setShowManualForm(true)}
            >
              Manual Schedule
            </Button>

            {(optimizedPrediction || manualPrediction) && (
              <Button
                className="w-56"
                variant="danger"
                onClick={() => { setOptimizedPrediction(null); setManualPrediction(null); }}
              >
                Clear Predictions
              </Button>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] pt-4 text-sm text-gray-500">
            <p>Historical trial data. Blue line = model prediction using actual doses. Run <em>Optimal Schedule</em> to see what the model recommends.</p>
          </div>

          <Link href="/patient">
            <Button variant="primary">← Back to Patients Dashboard</Button>
          </Link>
        </div>

        {/* Right Column */}
        <div className="w-full space-y-6">
          <div>
            <h3 className="text-xl font-semibold mt-8 mb-2">Treatment Timeline</h3>
            <PredictChart data={chartData} />
          </div>

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
