export interface PredBand {
    median: number[];
    lower:  number[];
    upper:  number[];
}

export interface PatientPred {
    mal:     PredBand;
    uefm:    PredBand;
    wmft:    PredBand;
    latentS: number[];   // structural recovery state, 0–1
    latentR: number[];   // motor memory state, 0–1
}

export interface Patient {
    // User-defined on creation.
    name: string;
    budget: number;
    maxDose: number;
    age: number;
    weeksSinceStroke: number;
    leftStroke: boolean;
    male: boolean;

    // Fixed horizon.
    horizon: number;

    // Used to keep track of past data.
    past: boolean;
    outcomes: number[];
    actions: number[];
    // Sparse observed MAL scores for past patients (null = no observation that week, 0-5 scale)
    observedMal: (number | null)[];
    // Sparse secondary outcome scores for past patients.
    observedUefm?: (number | null)[];
    observedWmft?: (number | null)[];

    // Prediction CI for past patients (populated by enrichWithTrajectory)
    pred?: PatientPred;

    // Created on registering model with mlflow.
    id: string;
    sourceSubjectId: number | null;
    displayId: string;

    // Model data to sync with mlflow.
    modelBayesian: {
        modelAlias: string;
        modelUri: string;
    };
    modelSGLD: {
        modelAlias: string;
        modelUri: string;
    }
}
