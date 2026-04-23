"use client"

import React, { useState, useRef, useEffect} from "react";
import Papa from "papaparse";
import { ResultsPutRequest } from "@/types/resultsPutRequest";
import Button from "@/components/ui/Button";

interface UploadDataFormProps {
    patientID: string;
    pastAvgOut: number[];
    pastDoseData: (number|null)[];
    setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
    onDataUpdated?: (newAvgOut: number[], newDoseData: (number|null)[]) => void;
}

export default function UploadDataForm({ patientID, pastAvgOut, pastDoseData, setShowForm, onDataUpdated }: UploadDataFormProps) {
    // Stores uploaded CSV file data.
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for chart plotting.
    const [pastAvgOutState, setPastAvgOutState] = useState(pastAvgOut);
    const [pastDoseDataState, setPastDoseDataState] = useState(pastDoseData);
    const [pastDoseDataStateInputs, setPastDoseDataStateInputs] = useState(pastDoseData.map(item => item === null ? "" : String(item)));
    const [validationError, setValidationError] = useState<string | null>(null);
    const lastRowRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (loading) {
            setProgress(0);
            interval = setInterval(() => {
                setProgress((prev) => {
                    if (prev < 90) {
                        return prev + 10;
                    } else {
                        return prev;
                    }
                });
            }, 200);
        } else {
            setProgress(100);
            setTimeout(() => setProgress(0), 400);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [loading]);

    useEffect(() => {
      if (lastRowRef.current) {
        lastRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, [pastDoseDataState.length]);

    // Function to handle manual CSV file upload.
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;

            const results = Papa.parse<Record<string, string>>(text, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
            });
              
            if (results.errors.length) {
                setValidationError("Error parsing CSV file. Please check the format.");
                console.error("CSV Parsing Errors:", results.errors);
                return;
            }

            const parsed = results.data;
            
            // Read into state.
            const newOutcomeState = parsed.map(row => Number(row.Outcome));
            const newDoseState = parsed.map(row => Number(row.Action));

            // Validate the data
            if (newOutcomeState.some(isNaN) || newDoseState.some(isNaN)) {
                setValidationError("Invalid data in CSV. Please check the values.");
                return;
            }

            setValidationError(null);
            setPastAvgOutState(newOutcomeState);
            setPastDoseDataState(newDoseState);
            setPastDoseDataStateInputs(newDoseState.map(item => item === null || Number.isNaN(item) ? "" : String(item)));
            setIsEditing(true);
        };

        reader.readAsText(file);
    };

    // Function to update outcome state.
    const updateOutcomeState = (index: number, newOutcome: string) => {
        const numValue = Number(newOutcome);
        if (isNaN(numValue)) {
            setValidationError("Please enter a valid number for MAL Score");
            return;
        }
        setValidationError(null);
        const newOutcomeState = [...pastAvgOutState];
        newOutcomeState[index] = numValue;
        setPastAvgOutState(newOutcomeState);
    }

    // Function to update dose state.
    const updateDoseState = (index: number, newDose: string) => {
        const newDoseState = [...pastDoseDataState];
        const newDoseStateInputs = [...pastDoseDataStateInputs];

        if (newDose === "") {
            newDoseState[index] = null;
            newDoseStateInputs[index] = newDose;
        } else {
            const numValue = Number(newDose);
            if (isNaN(numValue)) {
                setValidationError("Please enter a valid number for Treatment Hours");
                return;
            }
            newDoseState[index] = numValue;
            newDoseStateInputs[index] = newDose;
        }
        
        setValidationError(null);
        setPastDoseDataState(newDoseState);
        setPastDoseDataStateInputs(newDoseStateInputs);
    }

    // Function to add new outcome / dose pair.
    const addStatePair = () => {
        const newOutcomeState = [...pastAvgOutState];
        newOutcomeState.push(3.0);
        setPastAvgOutState(newOutcomeState);

        const newDoseState = [...pastDoseDataState];
        newDoseState.push(null);
        setPastDoseDataState(newDoseState);

        const newDoseStateInputs = [...pastDoseDataStateInputs];
        newDoseStateInputs.push("");
        setPastDoseDataStateInputs(newDoseStateInputs);
    }

    // Function to remove outcome / dose pair.
    const removeStatePair = (index: number) => {
        const newOutcomeState = [...pastAvgOutState];
        newOutcomeState.splice(index, 1);
        setPastAvgOutState(newOutcomeState);

        const newDoseState = [...pastDoseDataState];
        newDoseState.splice(index, 1);
        setPastDoseDataState(newDoseState);

        const newDoseStateInputs = [...pastDoseDataStateInputs];
        newDoseStateInputs.splice(index, 1);
        setPastDoseDataStateInputs(newDoseStateInputs);
    }

    // Function to revert changes
    const revertChanges = () => {
        setPastAvgOutState(pastAvgOut);
        setPastDoseDataState(pastDoseData);
        setPastDoseDataStateInputs(pastDoseData.map(item => item === null ? "" : String(item)));
        setValidationError(null);
    };

    // Function to finalize new update in database.
    // Called on form submission.
    const uploadData = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing) return;
        
        // Validate all data before submission
        if (pastAvgOutState.some(isNaN) || pastDoseDataState.some(dose => dose !== null && isNaN(dose))) {
            setValidationError("Please ensure all values are valid numbers");
            return;
        }

        setLoading(true);
        setSuccess(false);

        try {
            setStatusMessage("Saving observations…");
            const res = await fetch("/api/results", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientID,
                    pastAvgOutState,
                    pastDoseDataState,
                } satisfies ResultsPutRequest),
            });
            if (!res.ok) throw new Error("Failed to save observations");

            setStatusMessage("Updating model…");
            const retrainRes = await fetch(`/api/retrain/${patientID}`, { method: "POST" });
            if (!retrainRes.ok) throw new Error("Failed to update model");

            if (onDataUpdated) onDataUpdated(pastAvgOutState, pastDoseDataState);
            setSuccess(true);
            setIsEditing(false);
        } catch {
            setValidationError("Failed to update data. Please try again.");
        } finally {
            setLoading(false);
            setStatusMessage("");
        }
    };

    // Helper to check if there is any data
    const isEmpty = pastAvgOutState.length === 0 || pastDoseDataState.length === 0;

    return (
        <>
            <form onSubmit={uploadData} className="mb-4 space-y-6 min-w-[600px] max-w-3xl">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                    <h2 className="text-2xl font-bold">Observed Data</h2>
                    <div className="flex gap-2 ml-auto">
                        {!isEmpty && !isEditing ? (
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsEditing(true)}
                            >
                                Edit
                            </Button>
                        ) : (
                            !isEmpty && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => { setIsEditing(false); revertChanges(); }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            "Save"
                                        )}
                                    </Button>
                                </>
                            )
                        )}
                        <Button
                            type="button"
                            variant="danger"
                            onClick={() => setShowForm(false)}
                            className="ml-2"
                        >
                            Close
                        </Button>
                    </div>
                </div>

                {validationError && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {validationError}
                    </div>
                )}

                {isEmpty ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-gray-300 mb-4"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6 1a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <h3 className="text-lg font-semibold mb-2 text-gray-700">No observed data yet</h3>
                        <p className="text-gray-500 mb-6">To get started, upload a CSV file or enter your data manually.</p>
                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => fileInputRef.current?.click()}
                                className="!px-5 !py-2"
                            >
                                Upload CSV
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => { addStatePair(); setIsEditing(true); }}
                                className="!px-5 !py-2"
                            >
                                Enter Data Manually
                            </Button>
                        </div>
                        <input
                            type="file"
                            accept=".csv"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg">
                            <div className="grid grid-cols-4 gap-2 px-2 py-2 bg-gray-50 rounded-t-lg border-b border-gray-200 sticky top-0 z-10">
                                <div className="font-semibold">Treatment Week</div>
                                <div className="font-semibold">MAL Score</div>
                                <div className="font-semibold">Treatment Hours</div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {pastDoseDataState.map((value, i) => (
                                    <div
                                        className="grid grid-cols-4 gap-2 px-2 py-3 items-center"
                                        key={i}
                                        ref={i === pastDoseDataState.length - 1 ? lastRowRef : null}
                                    >
                                        <div>{i * 2}</div>
                                        <div>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={pastAvgOutState[i]}
                                                    onChange={(e) => updateOutcomeState(i, e.target.value)}
                                                    className="px-3 py-2 border rounded w-full"
                                                    required
                                                    aria-label="MAL Score"
                                                />
                                            ) : (
                                                <div className="px-3 py-2 bg-gray-50 rounded w-full border border-transparent">{pastAvgOutState[i]}</div>
                                            )}
                                        </div>
                                        <div>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={pastDoseDataStateInputs[i]}
                                                    onChange={(e) => updateDoseState(i, e.target.value)}
                                                    className={`px-3 py-2 border rounded w-full ${i === pastDoseDataState.length - 1 ? "bg-gray-200 text-gray-500 cursor-not-allowed" : ""}`}
                                                    disabled={i === pastDoseDataState.length - 1}
                                                    aria-label="Treatment Hours"
                                                />
                                            ) : (
                                                <div className="px-3 py-2 bg-gray-50 rounded w-full border border-transparent">{pastDoseDataStateInputs[i]}</div>
                                            )}
                                        </div>
                                        <div>
                                            {isEditing ? (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => removeStatePair(i)}
                                                    className="px-2 py-1 text-xs rounded border-gray-300 text-gray-500 hover:bg-gray-100"
                                                    aria-label="Remove row"
                                                >
                                                    Remove
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {(isEditing) && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
                                <div className="flex gap-2">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        disabled={!isEditing}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="!px-3 !py-1"
                                        disabled={!isEditing}
                                    >
                                        Upload CSV
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => { addStatePair(); setIsEditing(true); }}
                                        className="!px-3 !py-1"
                                        disabled={!isEditing}
                                    >
                                        Add New Row
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div className="text-sm text-gray-500 mt-2">
                    {/* You can add info here, e.g., Max Dose or Horizon if available */}
                </div>
                <div className="flex flex-col items-center w-full mt-6">
                    {loading && statusMessage && (
                        <div className="w-full flex justify-center z-20 mb-2">
                            <div className="max-w-lg w-full mx-auto px-6 py-3 bg-blue-50 border border-blue-300 rounded-lg shadow text-blue-900 text-base font-semibold flex items-center gap-3 justify-center text-center tracking-wide">
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                                {statusMessage}
                            </div>
                        </div>
                    )}
                    {loading && (
                        <div className="w-full h-1 bg-gray-200 rounded-b-lg overflow-hidden">
                            <div
                                className="h-full bg-[var(--color-primary)] transition-all duration-200"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                    {success && (
                        <div className="w-full flex justify-center z-20">
                            <div className="max-w-lg w-full mx-auto px-6 py-3 bg-green-50 border border-green-300 rounded-lg shadow text-green-900 text-base font-semibold flex items-center gap-3 justify-center text-center">
                                <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Observations saved. Model updated successfully.
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </>
    );
}