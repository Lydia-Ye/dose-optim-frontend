"use client";

import React, { useState } from "react";
import { Patient } from "@/types/patient";
import { PatientsPostRequest } from "@/types/patientsPostRoute";

interface PatientAddFormProps {
    patients: Patient[];
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>; 
    setShowForm: React.Dispatch<React.SetStateAction<boolean>>; 
}

export default function PatientAddForm({ patients, setPatients, setShowForm }: PatientAddFormProps) {
    const [name, setName] = useState("");
    const [budget, setBudget] = useState(30);
    const [maxDose, setMaxDose] = useState(10);
    const [age, setAge] = useState(80);
    const [weeksSinceStroke, setWeeksSinceStroke] = useState(15);
    const [leftStroke, setLeftStroke] = useState(true);
    const [male, setMale] = useState(true);
    // Horizon input in weeks
    const [horizonWeeks, setHorizonWeeks] = useState(52);
    
    // Loading for adding patient.
    const [addingLoading, setAddingLoading] = useState(false);

    // Calculate next patient ID
    const nextPatientId = patients.length + 1;

    // Function to add a new patient.
    const addPatient = async (e: React.FormEvent) => {
        setAddingLoading(true);

        // Prevents default form action (refresh page).
        e.preventDefault();

        // TODO: Error handling.

        const newPatient: PatientsPostRequest = {
            // User parameters.
            name: name.trim(),
            budget: budget,
            maxDose: maxDose,
            age: age,
            weeksSinceStroke: weeksSinceStroke,
            leftStroke: leftStroke,
            male: male,

            // Fixed horizon: total weeks; dose weeks = horizon / 2 (set in API route).
            horizon: horizonWeeks,

            // Past patient state.
            past: false,
            outcomes: [], 
            actions: [],
        };

        // Register new model with mlflow backend.
        // Populates with id, modelAlias and modelUri.
        try {
            const res = await fetch("/api/patients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newPatient),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error);
            } 

            const data = await res.json();
            setPatients([...patients, data.patient]);

        } catch (error) {
            console.error(error);
        
        } finally {
            // Reset form state.
            setName("");
            setBudget(30);
            setMaxDose(10);
            setAge(75);
            setWeeksSinceStroke(10);
            setLeftStroke(true);
            setMale(true);
            setHorizonWeeks(52);

            // Complete loading and close form.
            setAddingLoading(false);
            setShowForm(false);
        }
    };

    return (
        <form onSubmit={addPatient} className="space-y-6">
            <label htmlFor="nameInput" className="block text-sm font-medium text-[var(--foreground)]">
                Patient ID
            </label>
            <input
                type="text"
                id="nameInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`${nextPatientId}`}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                required
            />

            {/* Budget & Max Dose */}
            <div className="flex gap-4">
                <div className="w-1/2">
                    <label htmlFor="budgetInput" className="block text-sm font-medium text-[var(--foreground)]">
                        Total Treatment Hours
                    </label>
                    <input
                        type="text"
                        id="budgetInput"
                        value={budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        placeholder="30"
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        required
                    />
                </div>
                <div className="w-1/2">
                    <label htmlFor="maxDoseInput" className="block text-sm font-medium text-[var(--foreground)]">
                        Max Hours per Week {/* Max Dose */}
                    </label>
                    <input
                        type="text"
                        id="maxDoseInput"
                        value={maxDose}
                        onChange={(e) => setMaxDose(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        required
                    />
                </div>
            </div>

            {/* Age & Weeks Since Stroke */}
            <div className="flex gap-4">
                <div className="w-1/2">
                    <label htmlFor="ageInput" className="block text-sm font-medium text-[var(--foreground)]">
                        Age
                    </label>
                    <input
                        type="text"
                        id="ageInput"
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        required
                    />
                </div>
                <div className="w-1/2">
                    <label htmlFor="weeksSinceStrokeInput" className="block text-sm font-medium text-[var(--foreground)]">
                        Weeks Since Stroke at Start of Treatment
                    </label>
                    <input
                        type="text"
                        id="weeksSinceStrokeInput"
                        value={weeksSinceStroke}
                        onChange={(e) => setWeeksSinceStroke(Number(e.target.value))}
                        className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        required
                    />
                </div>
            </div>

            {/* Stroke Type & Gender */}
            <div className="flex gap-4">
                <div className="w-1/2">
                    <label className="block text-sm font-medium text-[var(--foreground)]">
                        Side of Stroke
                    </label>
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
                </div>

                <div className="w-1/2">
                    <label className="block text-sm font-medium text-[var(--foreground)]">
                        Sex at Birth
                    </label>
                    <div className="flex flex-col items-center border border-[var(--color-border)] rounded-lg shadow-sm  py-2">
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
                </div>
            </div>

            {/* Horizon */}
            <div>
                <label htmlFor="horizonInput" className="block text-sm font-medium text-[var(--foreground)]">
                    Total Treatment Weeks
                </label>
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
            </div>

            {/* Submit */}
            <button
                className="w-full px-4 py-3 mt-6 bg-[var(--color-primary)] text-white rounded-full hover:opacity-90 shadow-md"
                type="submit"
                disabled={addingLoading}
            >
                {addingLoading ? (
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : (
                    <p>Add Patient</p>
                )}
            </button>
        </form>
    );
}
