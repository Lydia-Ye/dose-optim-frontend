"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

import CurrentPredictChart from "@/components/CurrentPredictChart";
import UploadDataForm from "@/components/UploadDataForm";
import PatientEditForm from "@/components/PatientEditForm";
import ManualScheduleForm from "@/components/ManualScheduleForm";
import PredictionSummary from "@/components/PredictionSummary";

import { Patient } from "@/types/patient";
import Button from "./ui/Button";
import Badge from "./ui/Badge";

interface PatientPageProps {
  patient: Patient;
  setPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
}

interface ModelPrediction {
  maxOut: number[];
  futureAvgOut: number[];
  minOut: number[];
  futureDoseData: number[];
}

const emptyPrediction: ModelPrediction = {
  maxOut: [],
  futureAvgOut: [],
  minOut: [],
  futureDoseData: [],
};

export default function NewPatientPage({ patient, setPatient }: PatientPageProps) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showPatientEdit, setShowPatientEdit] = useState(false);
  const [showManualScheduleForm, setShowManualScheduleForm] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const [pastAvgOut, setPastAvgOut] = useState<number[]>(patient.outcomes);
  const [pastDoseData, setPastDoseData] = useState<number[]>(patient.actions);

  const [manualPrediction, setManualPrediction] = useState<ModelPrediction>(emptyPrediction);

  const hasPastData = pastAvgOut.length > 0 && pastDoseData.length > 0;

  const handleManualSchedule = useCallback(async (futureActions: number[]) => {
    try {
      const requestBody = {
        id: patient.id,
        future_actions: futureActions,
      };

      const res = await fetch("/api/manual-predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) throw new Error("Manual prediction failed");

      const data = await res.json();

      setManualPrediction({
        maxOut: data.maxPrediction,
        futureAvgOut: data.meanPrediction,
        minOut: data.minPrediction,
        futureDoseData: data.dosage,
      });
    } catch (err) {
      console.error("Manual schedule prediction error:", err);
    }
  }, [patient.id]);

  const handleDataUpdated = (newAvgOut: number[], newDoseData: (number | null)[]) => {
    setPastAvgOut(newAvgOut);
    setPastDoseData(newDoseData as number[]);
  };

  const handleCloseManualScheduleForm = () => {
    setShowManualScheduleForm(false);
    if (manualPrediction.futureAvgOut.length === 0) {
      setShowManual(false);
    }
  };

  const totalDose = pastDoseData.reduce((a, b) => a + b, 0);
  const currentMAL = Math.round(pastAvgOut[pastAvgOut.length - 1] * 1000) / 1000;

  return (
    <>
      {showManualScheduleForm && (
        <div className='fixed inset-0 bg-[rgba(0,0,0,0.2)] flex items-center justify-center z-50' onClick={handleCloseManualScheduleForm}>
          <div className='bg-white rounded-2xl shadow-lg p-6 text-center' onClick={(e) => e.stopPropagation()}>
            <ManualScheduleForm
              readonlyOutcomes={pastAvgOut}
              readonlyActions={pastDoseData}
              onSubmit={handleManualSchedule}
              setShowForm={setShowManualScheduleForm}
              maxDose={patient.maxDose}
              horizon={patient.horizon}
              budget={patient.budget}
              onClose={handleCloseManualScheduleForm}
            />
          </div>
        </div>
      )}

      {showUploadForm && (
        <div
          className='fixed inset-0 bg-[rgba(0,0,0,0.2)] flex items-center justify-center z-50'
          onClick={() => setShowUploadForm(false)}
        >
          <div
            className='bg-white rounded-2xl shadow-lg p-6 max-w-3xl w-full'
            onClick={(e) => e.stopPropagation()}
          >
            <UploadDataForm
              patientID={patient.id}
              pastAvgOut={pastAvgOut}
              pastDoseData={pastDoseData}
              setShowForm={setShowUploadForm}
              onDataUpdated={handleDataUpdated}
            />
          </div>
        </div>
      )}

      {showPatientEdit && (
        <div
          className='fixed inset-0 bg-[rgba(0,0,0,0.2)] flex items-center justify-center z-50'
          onClick={() => setShowPatientEdit(false)}
        >
          <div
            className='bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full text-center'
            onClick={(e) => e.stopPropagation()}
          >
            <PatientEditForm
              patient={patient}
              setPatient={setPatient}
              setShowForm={setShowPatientEdit}
            />
          </div>
        </div>
      )}

      <main className="w-full max-w-screen-xl mx-auto px-6 py-16 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-10 items-start">
        {/* Left Column: Info */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-gray-500">Patient Detail</h2>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">Patient {patient.name}</h1>
            <Badge variant="active">ACTIVE</Badge>
          </div>

          <div className="text-sm text-gray-600 space-y-3">
            <p><strong>Total Treatment Weeks:</strong> {patient.horizon * 2} weeks</p>
            <p><strong>Total Treatment Hours:</strong> {totalDose} hours</p>
            <p><strong>Remaining Treatment Hours:</strong> {patient.budget - totalDose} hours</p>
            <p><strong>Latest observed MAL Score:</strong> {currentMAL}</p>
          </div>

          <div className="space-y-4">
            <Button
              className="w-56"
              variant="secondary"
              onClick={() => setShowPatientEdit(true)}
            >
              Patient Details
            </Button>

            <Button
              onClick={() => setShowUploadForm(true)}
              variant="secondary"
              className="w-56"
            >
              Observed Data
            </Button>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-blue-600 mb-2">
                Predict Recovery Outcomes
              </h2>
              <div className="relative group">
                <span className="text-gray-400 cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </span>
                <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 w-64 p-2 bg-[var(--foreground)]/50 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none">
                  The model samples from the hierarchical Bayesian prior to predict recovery outcomes for your custom treatment schedule.
                </div>
              </div>
            </div>

            {!hasPastData && (
              <div className="text-xs text-red-500 mb-2">Please upload patient data before predicting outcomes.</div>
            )}

            <div className="space-y-2">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showManual}
                  onChange={(e) => {
                    if (!hasPastData) return;
                    setShowManual(e.target.checked);
                    if (e.target.checked) {
                      setShowManualScheduleForm(true);
                    } else {
                      setManualPrediction(emptyPrediction);
                    }
                  }}
                  className="form-checkbox text-green-600"
                  disabled={!hasPastData}
                />
                <span className="text-sm text-gray-700">Manual Schedule</span>
                <div className="relative group">
                  <span className="text-gray-400 cursor-help">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="16" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                  </span>
                  <div className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 w-64 p-2 bg-[var(--foreground)]/50 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 pointer-events-none">
                    Enter a custom treatment schedule to simulate predicted recovery outcomes.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {manualPrediction.futureAvgOut.length > 0 && (
            <Button
              variant="danger"
              onClick={() => {
                setManualPrediction(emptyPrediction);
                setShowManual(false);
              }}
            >
              Clear Prediction
            </Button>
          )}

          <div>
            <Link href="/patient">
              <Button variant="primary">← Back to Patients Dashboard</Button>
            </Link>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div className='w-full'>
          <h3 className="text-xl font-semibold mb-2">Treatment Timeline</h3>
          <CurrentPredictChart
            pastAvgOut={pastAvgOut}
            pastDoseData={pastDoseData}
            manualPrediction={manualPrediction}
            horizon={patient.horizon}
          />

          <PredictionSummary
            pastAvgOut={pastAvgOut}
            manualPrediction={manualPrediction}
          />

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center">
            {Number(patient.id) > 11 && Number(patient.id) !== 15 ? (
              <Link href={`/patient/${Number(patient.id) - 1}`}>
                <Button variant="outline">← Previous Time Step</Button>
              </Link>
            ) : (
              <div></div>
            )}

            {Number(patient.id) !== 14 && Number(patient.id) < 18 ? (
              <Link href={`/patient/${Number(patient.id) + 1}`}>
                <Button variant="outline">Next Time Step →</Button>
              </Link>
            ) : (
              <div></div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
