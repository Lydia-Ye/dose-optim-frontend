"use client"

import React, { useState, useRef, useEffect} from "react";
import Papa from "papaparse";
import { ResultsPutRequest } from "@/types/resultsPutRequest";
import Button from "@/components/ui/Button";
import {
    getAdaptiveNotebookSnapshot,
    isAdaptiveNotebookPatient,
    NotebookSnapshotWeek,
} from "@/lib/adaptiveNotebookPatients";

interface UploadDataFormProps {
    patientID: string;
    pastAvgOut: number[];
    pastObservedUefm?: (number | null)[];
    pastObservedWmft?: (number | null)[];
    pastDoseData: (number|null)[];
    setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
    onDataUpdated?: (
        newAvgOut: number[],
        newDoseData: (number|null)[],
        snapshotData?: {
            observedMal: (number | null)[];
            observedUefm: (number | null)[];
            observedWmft: (number | null)[];
        },
        newUefm?: (number | null)[],
        newWmft?: (number | null)[],
    ) => void;
}

export default function UploadDataForm({ patientID, pastAvgOut, pastObservedUefm, pastObservedWmft, pastDoseData, setShowForm, onDataUpdated }: UploadDataFormProps) {
    // Stores uploaded CSV file data.
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for chart plotting.
    const [pastAvgOutState, setPastAvgOutState] = useState(pastAvgOut);
    const [uefmState, setUefmState] = useState<(number | null)[]>(pastObservedUefm ?? pastAvgOut.map(() => null));
    const [wmftState, setWmftState] = useState<(number | null)[]>(pastObservedWmft ?? pastAvgOut.map(() => null));
    const [uefmInputs, setUefmInputs] = useState<string[]>((pastObservedUefm ?? pastAvgOut.map(() => null)).map(v => v == null ? "" : String(v)));
    const [wmftInputs, setWmftInputs] = useState<string[]>((pastObservedWmft ?? pastAvgOut.map(() => null)).map(v => v == null ? "" : String(v)));
    const [pastDoseDataState, setPastDoseDataState] = useState(pastDoseData);
    const [pastDoseDataStateInputs, setPastDoseDataStateInputs] = useState(pastDoseData.map(item => item === null ? "" : String(item)));
    const [validationError, setValidationError] = useState<string | null>(null);
    const lastRowRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");
    const [success, setSuccess] = useState(false);
    const isNotebookPatient = isAdaptiveNotebookPatient(patientID);
    const currentSnapshotWeek = ([1, 7, 14, 21] as const).includes((pastAvgOutState.length - 1) as NotebookSnapshotWeek)
        ? pastAvgOutState.length - 1
        : null;

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

    const updateUefmState = (index: number, val: string) => {
        const newInputs = [...uefmInputs];
        newInputs[index] = val;
        setUefmInputs(newInputs);
        if (val === "") {
            const next = [...uefmState]; next[index] = null; setUefmState(next);
        } else {
            const n = Number(val);
            if (isNaN(n)) { setValidationError("Please enter a valid number for UEFM Score"); return; }
            setValidationError(null);
            const next = [...uefmState]; next[index] = n; setUefmState(next);
        }
    }

    const updateWmftState = (index: number, val: string) => {
        const newInputs = [...wmftInputs];
        newInputs[index] = val;
        setWmftInputs(newInputs);
        if (val === "") {
            const next = [...wmftState]; next[index] = null; setWmftState(next);
        } else {
            const n = Number(val);
            if (isNaN(n)) { setValidationError("Please enter a valid number for WMFT Score"); return; }
            setValidationError(null);
            const next = [...wmftState]; next[index] = n; setWmftState(next);
        }
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
        setPastAvgOutState([...pastAvgOutState, 3.0]);
        setUefmState([...uefmState, null]);
        setWmftState([...wmftState, null]);
        setUefmInputs([...uefmInputs, ""]);
        setWmftInputs([...wmftInputs, ""]);
        setPastDoseDataState([...pastDoseDataState, null]);
        setPastDoseDataStateInputs([...pastDoseDataStateInputs, ""]);
    }

    // Function to remove outcome / dose pair.
    const removeStatePair = (index: number) => {
        const splice = <T,>(arr: T[]) => { const next = [...arr]; next.splice(index, 1); return next; };
        setPastAvgOutState(splice(pastAvgOutState));
        setUefmState(splice(uefmState));
        setWmftState(splice(wmftState));
        setUefmInputs(splice(uefmInputs));
        setWmftInputs(splice(wmftInputs));
        setPastDoseDataState(splice(pastDoseDataState));
        setPastDoseDataStateInputs(splice(pastDoseDataStateInputs));
    }

    // Function to revert changes
    const revertChanges = () => {
        const initUefm = pastObservedUefm ?? pastAvgOut.map(() => null);
        const initWmft = pastObservedWmft ?? pastAvgOut.map(() => null);
        setPastAvgOutState(pastAvgOut);
        setUefmState(initUefm);
        setWmftState(initWmft);
        setUefmInputs(initUefm.map(v => v == null ? "" : String(v)));
        setWmftInputs(initWmft.map(v => v == null ? "" : String(v)));
        setPastDoseDataState(pastDoseData);
        setPastDoseDataStateInputs(pastDoseData.map(item => item === null ? "" : String(item)));
        setValidationError(null);
    };

    const applyNotebookSnapshot = (week: NotebookSnapshotWeek) => {
        const snapshot = getAdaptiveNotebookSnapshot(patientID, week);
        if (!snapshot) return;

        const snapUefm = snapshot.observedUefm.map(v => v == null ? null : v as number | null);
        const snapWmft = snapshot.observedWmft.map(v => v == null ? null : v as number | null);
        setPastAvgOutState(snapshot.outcomes);
        setUefmState(snapUefm);
        setWmftState(snapWmft);
        setUefmInputs(snapUefm.map(v => v == null ? "" : String(v)));
        setWmftInputs(snapWmft.map(v => v == null ? "" : String(v)));
        setPastDoseDataState(snapshot.actions);
        setPastDoseDataStateInputs(snapshot.actions.map(item => item === null ? "" : String(item)));
        setValidationError(null);
        setIsEditing(false);
        setSuccess(true);
        if (onDataUpdated) {
            onDataUpdated(snapshot.outcomes, snapshot.actions, {
                observedMal: snapshot.observedMal,
                observedUefm: snapshot.observedUefm,
                observedWmft: snapshot.observedWmft,
            });
        }
    };

    // Function to finalize new update in database.
    // Called on form submission.
    const uploadData = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isEditing) return;
        
        // Validate all data before submission.
        // NaN is a valid sentinel for unobserved week-0 entries; only reject non-finite, non-NaN values (e.g. Infinity).
        if (pastAvgOutState.some(v => !Number.isNaN(v) && !Number.isFinite(v)) ||
            pastDoseDataState.some(dose => dose !== null && isNaN(dose))) {
            setValidationError("Please ensure all values are valid numbers");
            return;
        }

        setLoading(true);
        setSuccess(false);

        try {
            if (isNotebookPatient) {
                // Notebook patients are frontend-only — no backend DB record exists.
                // Just propagate the edited data to the parent.
                if (onDataUpdated) onDataUpdated(pastAvgOutState, pastDoseDataState, undefined, uefmState, wmftState);
            } else {
                setStatusMessage("Saving observations…");
                const res = await fetch("/api/results", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        patientID,
                        pastAvgOutState,
                        pastUefmState: uefmState,
                        pastWmftState: wmftState,
                        pastDoseDataState,
                    } satisfies ResultsPutRequest),
                });
                if (!res.ok) throw new Error("Failed to save observations");

                setStatusMessage("Updating model…");
                const retrainRes = await fetch(`/api/retrain/${patientID}`, { method: "POST" });
                if (!retrainRes.ok) throw new Error("Failed to update model");

                if (onDataUpdated) onDataUpdated(pastAvgOutState, pastDoseDataState, undefined, uefmState, wmftState);
            }
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

                {isNotebookPatient && isEditing && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                        <div className="text-sm text-gray-600">
                            Notebook snapshot
                        </div>
                        <div className="flex gap-2">
                            {([1, 7, 14, 21] as const).map((week) => (
                                <Button
                                    key={week}
                                    type="button"
                                    variant={currentSnapshotWeek === week ? "primary" : "outline"}
                                    onClick={() => applyNotebookSnapshot(week)}
                                    className="!px-3 !py-1"
                                >
                                    Week {week}
                                </Button>
                            ))}
                        </div>
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
                            <div className="grid grid-cols-6 gap-2 px-2 py-2 bg-gray-50 rounded-t-lg border-b border-gray-200 sticky top-0 z-10">
                                <div className="font-semibold text-sm">Treatment Week</div>
                                <div className="font-semibold text-sm">MAL Score <span className="font-normal text-gray-400">(0–5)</span></div>
                                <div className="font-semibold text-sm">UEFM Score <span className="font-normal text-gray-400">(0–66)</span></div>
                                <div className="font-semibold text-sm">WMFT Score <span className="font-normal text-gray-400">(0–1)</span></div>
                                <div className="font-semibold text-sm">Treatment Hours</div>
                                <div></div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {pastDoseDataState.map((value, i) => {
                                    const outcome = pastAvgOutState[i];
                                    // Skip unobserved slots (null/NaN sentinel for week 0)
                                    if (outcome == null || !Number.isFinite(Number(outcome))) return null;
                                    return (
                                    <div
                                        className="grid grid-cols-6 gap-2 px-2 py-3 items-center"
                                        key={i}
                                        ref={i === pastDoseDataState.length - 1 ? lastRowRef : null}
                                    >
                                        <div className="text-sm">{i}</div>
                                        <div>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    max="5"
                                                    value={pastAvgOutState[i]}
                                                    onChange={(e) => updateOutcomeState(i, e.target.value)}
                                                    className="px-2 py-2 border rounded w-full text-sm"
                                                    required
                                                    aria-label="MAL Score"
                                                />
                                            ) : (
                                                <div className="px-2 py-2 bg-gray-50 rounded w-full border border-transparent text-sm">{pastAvgOutState[i]}</div>
                                            )}
                                        </div>
                                        <div>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    min="0"
                                                    max="66"
                                                    value={uefmInputs[i] ?? ""}
                                                    onChange={(e) => updateUefmState(i, e.target.value)}
                                                    className="px-2 py-2 border rounded w-full text-sm"
                                                    placeholder="—"
                                                    aria-label="UEFM Score"
                                                />
                                            ) : (
                                                <div className="px-2 py-2 bg-gray-50 rounded w-full border border-transparent text-sm">
                                                    {uefmState[i] != null ? uefmState[i] : <span className="text-gray-400">—</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="1"
                                                    value={wmftInputs[i] ?? ""}
                                                    onChange={(e) => updateWmftState(i, e.target.value)}
                                                    className="px-2 py-2 border rounded w-full text-sm"
                                                    placeholder="—"
                                                    aria-label="WMFT Score"
                                                />
                                            ) : (
                                                <div className="px-2 py-2 bg-gray-50 rounded w-full border border-transparent text-sm">
                                                    {wmftState[i] != null ? wmftState[i] : <span className="text-gray-400">—</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    step="0.5"
                                                    value={pastDoseDataStateInputs[i]}
                                                    onChange={(e) => updateDoseState(i, e.target.value)}
                                                    className={`px-2 py-2 border rounded w-full text-sm ${i === pastDoseDataState.length - 1 ? "bg-gray-200 text-gray-500 cursor-not-allowed" : ""}`}
                                                    disabled={i === pastDoseDataState.length - 1}
                                                    aria-label="Treatment Hours"
                                                />
                                            ) : (
                                                <div className="px-2 py-2 bg-gray-50 rounded w-full border border-transparent text-sm">{pastDoseDataStateInputs[i]}</div>
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
                                    );
                                })}
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
                                {isNotebookPatient ? "Notebook snapshot loaded." : "Observations saved. Model updated successfully."}
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </>
    );
}
