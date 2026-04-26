"use client"

import { useState, useEffect } from "react";
import { Patient } from "@/types/patient";
import { PatientsPutRequest } from "@/types/patientsPutRequest";
import Button from "./ui/Button";

interface PatientEditFormProps {
    patient: Patient;
    setPatient: React.Dispatch<React.SetStateAction<Patient | null>>;
    setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function PatientEditForm({ patient, setPatient, setShowForm }: PatientEditFormProps) {
    const [name, setName] = useState(patient.name);
    const [budget, setBudget] = useState(patient.budget);
    const [maxDose, setMaxDose] = useState(patient.maxDose);
    const [age, setAge] = useState(patient.age);
    const [weeksSinceStroke, setWeeksSinceStroke] = useState(patient.weeksSinceStroke);
    const [leftStroke, setLeftStroke] = useState(patient.leftStroke);
    const [male, setMale] = useState(patient.male);
    const [horizonWeeks, setHorizonWeeks] = useState(patient.horizon * 2);
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");

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

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatusMessage("Updating patient information…");
        try {
            // Simulate staged backend process
            await new Promise((resolve) => setTimeout(resolve, 1000));
            setStatusMessage("Updating prediction model…");

            const requestBody: PatientsPutRequest = {
                patientID: patient.id,
                name: name,
                aliasBayesian: patient.modelBayesian.modelAlias,
                aliasSGLD: patient.modelSGLD.modelAlias,
                outcomes: patient.outcomes,
                actions: patient.actions,
                initOutcome: patient.outcomes[patient.outcomes.length - 1],
                budget: budget,
                maxDose: maxDose,
                horizon: horizonWeeks / 2,
                context: {
                    age: age,
                    weeksSinceStroke: weeksSinceStroke,
                    leftStroke: leftStroke,
                    male: male,
                },
                sgld: false
            };

            const res = await fetch("/api/patients", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to update patient info");
            }

            const data = await res.json();

            // Update the patient data in the parent component with all fields
            const updatedPatient = {
                ...patient,
                name: name,
                budget: budget,
                maxDose: maxDose,
                age: age,
                weeksSinceStroke: weeksSinceStroke,
                leftStroke: leftStroke,
                male: male,
                horizon: horizonWeeks / 2, // Convert back to original format
                modelBayesian: data.patient.modelBayesian,
                modelSGLD: data.patient.modelSGLD
            };

            setPatient(updatedPatient);
            setIsEditing(false);
            setStatusMessage("");
            // Show success message
            // alert("Patient information updated successfully!");
        } catch (error) {
            console.error("Error updating patient:", error);
            setStatusMessage("");
            alert("Failed to update patient information. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={onSubmit} className="space-y-6 relative">
            <div className="flex flex-col sm:flex-row sm:justify-between mb-6 gap-4">
                <h2 className="text-2xl font-bold">Edit Patient Info</h2>
                <div className="flex gap-2 ml-auto">
                    {!isEditing ? (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setIsEditing(true)}
                        >
                            Edit
                        </Button>
                    ) : (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsEditing(false);
                                    setName(patient.name);
                                    setBudget(patient.budget);
                                    setMaxDose(patient.maxDose);
                                    setAge(patient.age);
                                    setWeeksSinceStroke(patient.weeksSinceStroke);
                                    setLeftStroke(patient.leftStroke);
                                    setMale(patient.male);
                                    setHorizonWeeks(patient.horizon * 2);
                                }}
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

            <div className="space-y-4">
                <h3 className="text-xl font-semibold mb-4">Patient ID: {patient.displayId}</h3>

                {/* Budget & Max Dose */}
                <div className="flex gap-4">
                    <div className="w-1/2">
                        <label htmlFor="budgetInput" className="block text-sm font-medium text-[var(--foreground)] text-left">
                            Total Treatment Hours
                        </label>
                        {isEditing ? (
                            <input
                                type="number"
                                id="budgetInput"
                                value={budget}
                                onChange={(e) => setBudget(Number(e.target.value))}
                                placeholder="60"
                                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                required
                            />
                        ) : (
                            <div className="w-full px-4 py-2 bg-gray-50 rounded-lg">{budget}</div>
                        )}
                    </div>
                    <div className="w-1/2">
                        <label htmlFor="maxDoseInput" className="block text-sm font-medium text-[var(--foreground)] text-left">
                            Max Hours per Week
                        </label>
                        {isEditing ? (
                            <input
                                type="number"
                                id="maxDoseInput"
                                value={maxDose}
                                onChange={(e) => setMaxDose(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                required
                            />
                        ) : (
                            <div className="w-full px-4 py-2 bg-gray-50 rounded-lg">{maxDose}</div>
                        )}
                    </div>
                </div>

                {/* Age & Weeks Since Stroke */}
                <div className="flex gap-4">
                    <div className="w-1/2">
                        <label htmlFor="ageInput" className="block text-sm font-medium text-[var(--foreground)] text-left">
                            Age
                        </label>
                        {isEditing ? (
                            <input
                                type="number"
                                id="ageInput"
                                value={age}
                                onChange={(e) => setAge(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                required
                            />
                        ) : (
                            <div className="w-full px-4 py-2 bg-gray-50 rounded-lg">{age}</div>
                        )}
                    </div>
                    <div className="w-1/2">
                        <label htmlFor="weeksSinceStrokeInput" className="block text-sm font-medium text-[var(--foreground)] text-left">
                            Weeks Since Stroke at Start of Treatment
                        </label>
                        {isEditing ? (
                            <input
                                type="number"
                                id="weeksSinceStrokeInput"
                                value={weeksSinceStroke}
                                onChange={(e) => setWeeksSinceStroke(Number(e.target.value))}
                                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                                required
                            />
                        ) : (
                            <div className="w-full px-4 py-2 bg-gray-50 rounded-lg">{weeksSinceStroke}</div>
                        )}
                    </div>
                </div>

                {/* Stroke Type & Gender */}
                <div className="flex gap-4">
                    <div className="w-1/2">
                        <label className="block text-sm font-medium text-[var(--foreground)] text-left">
                            Side of Stroke
                        </label>
                        {isEditing ? (
                            <div className="flex flex-col items-center border border-[var(--color-border)] rounded-lg shadow-sm py-2">
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="strokeType"
                                        value="Left"
                                        checked={leftStroke === true}
                                        onChange={() => setLeftStroke(true)}
                                        className="form-radio text-[var(--color-primary)]"
                                        required
                                    />
                                    <span className="ml-2 text-[var(--foreground)]">Left</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="strokeType"
                                        value="Right"
                                        checked={leftStroke === false}
                                        onChange={() => setLeftStroke(false)}
                                        className="form-radio text-[var(--color-primary)]"
                                        required
                                    />
                                    <span className="ml-2 text-[var(--foreground)]">Right</span>
                                </label>
                            </div>
                        ) : (
                            <div className="w-full px-4 py-2 bg-gray-50 rounded-lg">{leftStroke ? "Left" : "Right"}</div>
                        )}
                    </div>

                    <div className="w-1/2">
                        <label className="block text-sm font-medium text-[var(--foreground)] text-left">
                            Sex at Birth
                        </label>
                        {isEditing ? (
                            <div className="flex flex-col items-center border border-[var(--color-border)] rounded-lg shadow-sm py-2">
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="Male"
                                        checked={male === true}
                                        onChange={() => setMale(true)}
                                        className="form-radio text-[var(--color-primary)]"
                                        required
                                    />
                                    <span className="ml-2 text-[var(--foreground)]">Male</span>
                                </label>
                                <label className="inline-flex items-center">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value="Female"
                                        checked={male === false}
                                        onChange={() => setMale(false)}
                                        className="form-radio text-[var(--color-primary)]"
                                        required
                                    />
                                    <span className="ml-2 text-[var(--foreground)]">Female</span>
                                </label>
                            </div>
                        ) : (
                            <div className="w-full px-4 py-2 bg-gray-50 rounded-lg">{male ? "Male" : "Female"}</div>
                        )}
                    </div>
                </div>

                {/* Horizon */}
                <div>
                    <label htmlFor="horizonInput" className="block text-sm font-medium text-[var(--foreground)] text-left">
                        Total Treatment Weeks
                    </label>
                    {isEditing ? (
                        <input
                            type="number"
                            id="horizonInput"
                            value={horizonWeeks}
                            onChange={(e) => setHorizonWeeks(Number(e.target.value))}
                            min={2}
                            step={2}
                            className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            required
                        />
                    ) : (
                        <div className="w-full px-4 py-2 bg-gray-50 rounded-lg">{horizonWeeks}</div>
                    )}
                </div>
            </div>
            <div className="flex flex-col items-center w-full mt-6">
                {loading && statusMessage && (
                    <div className="w-full flex justify-center z-20 mb-2">
                        <div className="max-w-lg w-full mx-auto px-6 py-3 bg-green-50 border border-green-300 rounded-lg shadow text-green-900 text-base font-semibold flex items-center justify-center text-center tracking-wide" style={{letterSpacing: '0.01em', fontSize: '1.1rem'}}>
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
            </div>
        </form>
    );
}
