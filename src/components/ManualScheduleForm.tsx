"use client";

import React, { useState, useRef, useEffect } from "react";
import Button from "@/components/ui/Button";

interface ManualScheduleFormProps {
  readonlyOutcomes: number[];
  readonlyActions: number[];
  onSubmit: (futureActions: number[]) => void;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  maxDose: number;
  horizon: number;
  budget: number;
  onClose?: () => void;
}

export default function ManualScheduleForm({
  readonlyOutcomes,
  readonlyActions,
  onSubmit,
  setShowForm,
  maxDose,
  horizon,
  budget,
  onClose,
}: ManualScheduleFormProps) {
  const [futureActions, setFutureActions] = useState<number[]>(Array(horizon).fill(0));
  const [addedRow, setAddedRow] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const lastRowRef = useRef<HTMLDivElement>(null);

  // Calculate number of future actions
  const numFutureActions = horizon - (readonlyOutcomes.length - 2) - 1;

  // Only keep the correct number of future actions in state
  useEffect(() => {
    setFutureActions(Array(numFutureActions).fill(0));
  }, [numFutureActions]);

  const updateAction = (index: number, value: string) => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > maxDose) {
      setValidationError(`Dose must be between 0 and ${maxDose} hours`);
      return;
    }
    setValidationError(null);
    const newActions = [...futureActions];
    newActions[index] = numValue;
    setFutureActions(newActions);
  };

  const applyPreset = (type: 'increasing' | 'decreasing' | 'flat') => {
    const newActions = Array(numFutureActions).fill(0);
    
    // Calculate remaining budget
    const pastActionsSum = readonlyActions.reduce((sum, action) => sum + (action || 0), 0);
    const remainingBudget = budget - pastActionsSum;
    
    if (remainingBudget <= 0) {
      setValidationError("No remaining budget for future actions");
      return;
    }

    switch (type) {
      case 'increasing':
        // Calculate total weight for increasing schedule
        const increasingWeight = (numFutureActions * (numFutureActions + 1)) / 2;
        for (let i = 0; i < numFutureActions; i++) {
          // Distribute remaining budget proportionally to weights
          newActions[i] = (remainingBudget * (i + 1)) / increasingWeight;
        }
        break;
      case 'decreasing':
        // Calculate total weight for decreasing schedule
        const decreasingWeight = (numFutureActions * (numFutureActions + 1)) / 2;
        for (let i = 0; i < numFutureActions; i++) {
          // Distribute remaining budget proportionally to weights
          newActions[i] = (remainingBudget * (numFutureActions - i)) / decreasingWeight;
        }
        break;
      case 'flat':
        // Distribute remaining budget evenly
        const flatDose = remainingBudget / numFutureActions;
        newActions.fill(flatDose);
        break;
    }
    
    // Ensure no single dose exceeds maxDose
    for (let i = 0; i < numFutureActions; i++) {
      newActions[i] = Math.min(newActions[i], maxDose);
    }
    
    setFutureActions(newActions);
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all doses are within bounds
    const invalidDose = futureActions.find(dose => dose < 0 || dose > maxDose);
    if (invalidDose !== undefined) {
      setValidationError(`All doses must be between 0 and ${maxDose} hours`);
      return;
    }

    // Validate all weeks have values
    if (futureActions.length !== numFutureActions) {
      setValidationError(`Schedule must cover all ${numFutureActions} weeks`);
      return;
    }

    onSubmit(futureActions);
    setShowForm(false);
  };

  useEffect(() => {
    if (addedRow && lastRowRef.current) {
      lastRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setAddedRow(false);
    }
  }, [futureActions.length, addedRow]);

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-6 min-w-[700px] max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold">Manual Schedule </h2>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            if (onClose) onClose();
            else setShowForm(false);
          }}
          className="ml-auto"
        >
          Close
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row w-full gap-10">
        {/* Left: Schedule Table */}
        <div className="flex-1">
          {validationError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {validationError}
            </div>
          )}
          <div className="overflow-x-auto max-h-96 overflow-y-auto rounded-lg">
            <div className="grid grid-cols-4 gap-2 px-2 py-2 bg-gray-50 rounded-t-lg border-b border-gray-200 sticky top-0 z-10">
              <div className="font-semibold">Treatment Week</div>
              <div className="font-semibold">MAL Score</div>
              <div className="font-semibold">Treatment Hours</div>
              <div className="font-semibold">Status</div>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Read-only past data */}
              {readonlyOutcomes.map((outcome, i) => {
                const isLast = i === readonlyOutcomes.length - 1;
                return (
                  <div className="grid grid-cols-4 gap-2 px-2 py-3 items-center" key={`row-${i}`} ref={isLast ? lastRowRef : null}>
                    <div>{i}</div>
                    <div>
                      <input
                        type="text"
                        value={outcome.toFixed(2)}
                        readOnly
                        className="px-3 py-2 border rounded w-full bg-gray-100 text-gray-500"
                      />
                    </div>
                    <div>
                      {isLast && numFutureActions > 0 ? (
                        <input
                          type="number"
                          min="0"
                          max={maxDose}
                          step="any"
                          value={futureActions[0]}
                          onChange={e => updateAction(0, e.target.value)}
                          className="px-3 py-2 border rounded w-full"
                        />
                      ) : (
                        <input
                          type="text"
                          value={readonlyActions[i] !== null && readonlyActions[i] !== undefined ? Number(readonlyActions[i]).toFixed(2) : ""}
                          readOnly
                          className="px-3 py-2 border rounded w-full bg-gray-100 text-gray-500"
                        />
                      )}
                    </div>
                    <div className="text-gray-400 text-sm">
                      Observed
                    </div>
                  </div>
                );
              })}
              {/* Future planned data */}
              {Array.from({ length: numFutureActions }).map((_, idx) => (
                <div className="grid grid-cols-4 gap-2 px-2 py-3 items-center" key={`future-row-${idx}`}> 
                  <div>{readonlyOutcomes.length + idx}</div>
                  <div>
                    <input
                      type="text"
                      value={""}
                      readOnly
                      className="px-3 py-2 border rounded w-full bg-gray-100 text-gray-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max={maxDose}
                      step="any"
                      value={futureActions[idx]}
                      onChange={e => updateAction(idx, e.target.value)}
                      className="px-3 py-2 border rounded w-full"
                    />
                  </div>
                  <div className="text-gray-400 text-sm">
                    Planned
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-2">
            Max Dose: {maxDose} hours | Horizon: {horizon * 2} weeks
          </div>
        </div>
        {/* Right: Quick Presets Panel */}
        <div className="w-full sm:w-64 flex flex-col gap-4 items-center border-l border-gray-200 pl-6">
          <span className="mb-2 text-base font-medium text-gray-700">Quick Schedule Presets</span>
          <Button
            type="button"
            variant="outline"
            onClick={() => applyPreset('increasing')}
            className="w-full flex flex-col items-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 text-blue-500"><polyline points="6 15 12 9 18 15"></polyline></svg>
            <span className="font-semibold">Increasing</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => applyPreset('decreasing')}
            className="w-full flex flex-col items-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 text-green-500"><polyline points="6 9 12 15 18 9"></polyline></svg>
            <span className="font-semibold">Decreasing</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => applyPreset('flat')}
            className="w-full flex flex-col items-center"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1 text-gray-500"><line x1="6" y1="12" x2="18" y2="12"></line></svg>
            <span className="font-semibold">Flat</span>
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="mt-8 w-full"
          >
            Apply Manual Schedule
          </Button>
        </div>
      </div>
    </form>
  );
}
