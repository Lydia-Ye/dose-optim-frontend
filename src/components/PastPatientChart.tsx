"use client";

import {
  Chart as ChartJS,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController,
  Filler,
  ChartOptions,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { PAST_PATIENT_DISPLAY_WEEKS } from "@/lib/pastPatientConstants";

ChartJS.register(
  LinearScale, BarElement, PointElement, LineElement,
  Legend, Tooltip, LineController, BarController, Filler
);

// Matches the notebook color palette exactly
const MOD_COLORS: Record<string, { line: string; fill: string }> = {
  MAL:  { line: "rgb(34, 139, 34)",   fill: "rgba(34, 139, 34,  0.18)" },
  UEFM: { line: "rgb(30,  90,  200)", fill: "rgba(30,  90,  200, 0.18)" },
  WMFT: { line: "rgb(128, 0,   128)", fill: "rgba(128, 0,   128, 0.18)" },
};

const LATENT_S_COLOR = "rgb(86, 180, 233)";   // #56B4E9 — cyan dashed
const LATENT_R_COLOR = "rgb(230, 159, 0)";    // #E69F00 — orange dashed
const OBS_COLOR      = "rgb(220, 50,  50)";   // red scatter dots

export interface PlotRow {
  time:     number;
  lower:    number;
  median:   number;
  upper:    number;
  median_s: number;
  median_r: number;
}

export interface ObsRow {
  time:    number;
  obs_val: number;
}

interface PastPatientChartProps {
  /** Predicted CI rows (sorted by time) — from stan_plot_data. */
  predRows:  PlotRow[];
  /** Observed data rows — may be sparse. */
  obsRows:   ObsRow[];
  /** Dose hours per week (index = week, 0-based). */
  doseData:  number[];
  /** One of "MAL" | "UEFM" | "WMFT" — drives colors and labels. */
  metric:    "MAL" | "UEFM" | "WMFT";
  yLabel:    string;
  yMax:      number;
}

export default function PastPatientChart({
  predRows, obsRows, doseData, metric, yLabel, yMax,
}: PastPatientChartProps) {
  const { line: modLine, fill: modFill } = MOD_COLORS[metric];

  // Scatter points for observed data
  const obsPoints = obsRows.map((r) => ({ x: r.time, y: r.obs_val }));

  // Dose bars — skip zero-dose weeks to keep chart clean
  const dosePoints = doseData
    .map((h, w) => ({ x: w + 0.5, y: h > 0 ? h : null }))
    .filter((p): p is { x: number; y: number } => p.y !== null);

  const maxDose   = doseData.reduce((m, v) => Math.max(m, v), 0);
  const yRightMax = Math.ceil(maxDose * 2) || 12;

  const options: ChartOptions<"line" | "bar"> = {
    animation: false,
    responsive: true,
    scales: {
      x: {
        type: "linear",
        min: 0,
        max: PAST_PATIENT_DISPLAY_WEEKS,
        title: { display: true, text: "Time (weeks)" },
        ticks: { maxTicksLimit: 20 },
      },
      "y-left": {
        type: "linear",
        position: "left",
        title: { display: true, text: yLabel },
        min: 0,
        max: yMax,
        ticks: { maxTicksLimit: 8 },
      },
      "y-right": {
        type: "linear",
        position: "right",
        title: { display: true, text: "Treatment Hours" },
        min: 0,
        max: yRightMax,
        grid: { drawOnChartArea: false },
        display: dosePoints.length > 0,
      },
    },
    plugins: {
      legend: {
        labels: {
          // Hide the CI bound datasets (prefixed with "_")
          filter: (item) => !item.text?.startsWith("_"),
          boxWidth: 16,
          padding: 12,
          font: { size: 11 },
          usePointStyle: true,
        },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: (items) =>
            items.length ? `Week ${Math.floor(items[0].parsed.x)}` : "",
        },
      },
    },
  };

  const chartData = {
    datasets: [
      // ── CI upper bound (invisible, anchors fill region) ──────────────────
      {
        type:             "line" as const,
        label:            "_ci_upper",
        data:             predRows.map((r) => ({ x: r.time, y: r.upper })),
        borderColor:      "transparent",
        backgroundColor:  modFill,
        pointRadius:      0,
        pointHoverRadius: 0,
        fill:             false as const,
        yAxisID:          "y-left",
        tension:          0,
      },
      // ── CI lower bound (fills back to upper — creates ribbon) ────────────
      {
        type:             "line" as const,
        label:            "_ci_lower",
        data:             predRows.map((r) => ({ x: r.time, y: r.lower })),
        borderColor:      "transparent",
        backgroundColor:  modFill,
        pointRadius:      0,
        pointHoverRadius: 0,
        fill:             "-1" as const,
        yAxisID:          "y-left",
        tension:          0,
      },
      // ── Median prediction line ───────────────────────────────────────────
      {
        type:             "line" as const,
        label:            `Predicted ${metric}`,
        data:             predRows.map((r) => ({ x: r.time, y: r.median })),
        borderColor:      modLine,
        backgroundColor:  "transparent",
        borderWidth:      1.5,
        pointRadius:      0,
        pointHoverRadius: 3,
        fill:             false as const,
        yAxisID:          "y-left",
        tension:          0,
      },
      // ── Latent s — structural recovery (cyan dashed) ─────────────────────
      {
        type:             "line" as const,
        label:            "Spontaneous",
        data:             predRows.map((r) => ({ x: r.time, y: r.median_s })),
        borderColor:      LATENT_S_COLOR,
        backgroundColor:  "transparent",
        borderWidth:      1.2,
        borderDash:       [5, 4],
        pointRadius:      0,
        pointHoverRadius: 3,
        fill:             false as const,
        yAxisID:          "y-left",
        tension:          0,
      },
      // ── Latent r — motor memory (orange dashed) ───────────────────────────
      {
        type:             "line" as const,
        label:            "Learning",
        data:             predRows.map((r) => ({ x: r.time, y: r.median_r })),
        borderColor:      LATENT_R_COLOR,
        backgroundColor:  "transparent",
        borderWidth:      1.2,
        borderDash:       [5, 4],
        pointRadius:      0,
        pointHoverRadius: 3,
        fill:             false as const,
        yAxisID:          "y-left",
        tension:          0,
      },
      // ── Observed data — red scatter dots (no connecting line) ────────────
      {
        type:                 "line" as const,
        label:                "Observed data",
        data:                 obsPoints,
        borderColor:          "transparent",
        backgroundColor:      OBS_COLOR,
        showLine:             false,
        pointRadius:          6,
        pointHoverRadius:     8,
        pointBackgroundColor: OBS_COLOR,
        fill:                 false as const,
        yAxisID:              "y-left",
      },
      // ── Dose bars ─────────────────────────────────────────────────────────
      ...(dosePoints.length > 0
        ? [
            {
              type:            "bar" as const,
              label:           "Dose Schedule",
              backgroundColor: "rgb(34, 139, 34)",
              borderWidth:     0,
              yAxisID:         "y-right",
              barPercentage:   0.9,
              data:            dosePoints,
            },
          ]
        : []),
    ],
  };

  return <Chart type="bar" data={chartData} options={options} />;
}
