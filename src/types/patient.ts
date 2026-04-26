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

    // Created on registering model with mlflow.
    id: string;

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