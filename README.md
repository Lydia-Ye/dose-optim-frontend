# dose-optim-frontend

Clinical web application for AI-driven stroke rehabilitation dose optimization. Clinicians can review enrolled patients, inspect recovery trajectories, compare treatment dose schedules, and record observed outcomes for active patients.

> **This is the frontend repository.** The modeling and persistence layer runs in a separate FastAPI backend. The deployed backend is available at `https://precision-rehab-backend-791208053302.us-west2.run.app`.

## Status

The current code is adapted from [`precision-rehab-demo`](https://github.com/Lydia-Ye/precision-rehab-demo), a standalone frontend-only demo that ran entirely on mock data.

## What it does

- **Patient dashboard** — list and manage enrolled rehabilitation patients
- **Trajectory chart** — visualizes observed MAL scores and predicted recovery curves from a subject's treatment history
- **Recommended schedule** — requests backend model output for personalized weekly treatment planning
- **Manual schedule comparison** — enter a custom dose schedule and compare predicted outcomes
- **Active patient workflow** — add new patients, run predictions, and record observed outcomes

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Runtime | Node.js 20 LTS |
| Styling | Tailwind CSS |
| Containerization | Docker |
| CI/CD | GitHub Actions → GCP Artifact Registry → Cloud Run |


## Architecture

```
Browser
    │  HTTPS
    ▼
Next.js frontend          ← this repo
    │  HTTP via server-side proxy routes in src/app/api/
    ▼
FastAPI backend            ← https://precision-rehab-backend-791208053302.us-west2.run.app
    │
    ▼
PostgreSQL
```

The frontend never calls the backend directly from the browser. Browser requests go to Next.js API routes under `src/app/api/`; those server-side routes use `BACKEND_URL` to call the FastAPI service.

## Project structure

```
src/
  app/
    api/
      patients/         ← GET list, POST create, PUT update
      patients/[id]/    ← GET single patient with trajectory
      results/          ← POST optimize → recommended schedule
      manual-predict/   ← POST manual schedule prediction
      patientinfo/      ← PUT update patient horizon
    patient/
      page.tsx          ← Patient dashboard (list view)
      [id]/page.tsx     ← Patient detail page
  components/
    PastPatientPage.tsx    ← Trial subject view with optimize/manual-predict
    NewPatientPage.tsx     ← Active patient view
    CurrentPredictChart.tsx
    PredictChart.tsx
  lib/
    backend.ts          ← Shared adapter: BackendPatient types, toFrontendPatient, enrichWithTrajectory, fetch helpers
  types/                ← TypeScript interfaces (Patient, request/response shapes)
```

## Running locally

**Prerequisites:** the backend stack must be running first.

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000`. For local development, `BACKEND_URL` usually points to `http://localhost:8000`. To connect the local frontend to the deployed backend, set:

```bash
BACKEND_URL=https://precision-rehab-backend-791208053302.us-west2.run.app
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8000` | FastAPI backend base URL used by Next.js server routes |

## Loading demo data

After the backend is up, import the 395 trial subjects from the CSV. Use `http://localhost:8000` for a local backend, or the deployed backend URL:

```bash
BACKEND_URL=https://precision-rehab-backend-791208053302.us-west2.run.app

curl -X POST "$BACKEND_URL/v1/admin/import-csv" \
  -F "file=@path/to/all_subjects_parameters.csv"
```

Subjects appear in the patient dashboard as past patients. Click any subject to view their predicted recovery trajectory and run the model.
