"use client";

import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController,
  Filler,
  ChartOptions
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController,
  Filler
);

interface ModelPrediction {
  maxOut: number[];
  futureAvgOut: number[];
  minOut: number[];
  futureDoseData: number[];
}

interface ChartProps {
  pastAvgOut: number[];
  pastDoseData: number[];
  manualPrediction: ModelPrediction;
  horizon: number;
}

export default function CurrentPredictChart({
  pastAvgOut,
  pastDoseData,
  manualPrediction,
  horizon
}: ChartProps) {
  if (!pastAvgOut || pastAvgOut.length === 0) {
    return <p className="mt-20 mb-80 text-center text-[var(--color-warning)]">Please upload patient data for visualization.</p>;
  }

  const n = pastAvgOut.length;
  const hasManual = manualPrediction.futureAvgOut.length > 0;
  const lastObserved = pastAvgOut.at(-1) ?? 0;

  // Layout: linear x-axis where week N occupies the band [N, N+1).
  //   MAL points    → x = N       (left edge of each week's column)
  //   Dose bars     → x = N + 0.5 (center of each week's column)
  // Reading left-to-right: MAL(0) measured → Dose(0) applied → MAL(1) measured → …

  // --- Observed MAL line ---
  const malObserved = pastAvgOut.map((y, w) => ({ x: w, y }));

  // --- Predicted MAL + confidence band (connect from last observed point) ---
  const malPredicted = hasManual
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: manualPrediction.futureAvgOut[n + i] ?? null,
        })),
      ]
    : [];

  const malMax = hasManual
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: manualPrediction.maxOut[n + i] ?? null,
        })),
      ]
    : [];

  const malMin = hasManual
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: manualPrediction.minOut[n + i] ?? null,
        })),
      ]
    : [];

  // --- Single merged dose dataset ---
  // Past doses:   weeks 0..n-2  at x = 0.5, 1.5, …, n-1.5  (green)
  // Future doses: weeks n-1..horizon-1 at x = n-0.5, …, horizon-0.5 (pink)
  const xMax = horizon;
  const dosePoints: { x: number; y: number | null }[] = [];
  const doseColors: string[] = [];
  for (let w = 0; w < xMax; w++) {
    const isPast = w < n - 1;
    dosePoints.push({
      x: w + 0.5,
      y: isPast
        ? (pastDoseData[w] ?? null)
        : (hasManual ? (manualPrediction.futureDoseData[w] ?? null) : null),
    });
    doseColors.push(isPast ? "rgb(34, 139, 34)" : "rgba(134, 210, 134, 0.8)");
  }

  const options: ChartOptions<"line" | "bar"> = {
    scales: {
      x: {
        type: "linear",
        // Small padding so MAL(0) at x=0 and last bar aren't clipped
        min: -0.5,
        max: xMax + 0.5,
        title: { display: true, text: "Treatment Week" },
        // Place ticks at dose bar centres (0.5, 1.5, …) so labels align with bars
        afterBuildTicks: (axis: any) => {
          axis.ticks = Array.from({ length: xMax }, (_, i) => ({ value: i + 0.5 }));
        },
        ticks: {
          callback: (_value: number | string, index: number) => String(index),
        },
      },
      "y-left": {
        type: "linear",
        display: true,
        position: "left",
        title: { display: true, text: "MAL Score" },
        min: 0,
        max: 5,
        ticks: { stepSize: 1 },
      },
      "y-right": {
        type: "linear",
        display: true,
        position: "right",
        title: { display: true, text: "Treatment Hours" },
        min: 0,
        max: 12,
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        labels: {
          filter: (legendItem) =>
            !["Manual Schedule Max Outcome", "Manual Schedule Min Outcome"].includes(
              legendItem.text
            ),
          boxWidth: 16,
          padding: 12,
          font: { size: 12 },
          usePointStyle: true,
        },
      },
      tooltip: {
        mode: "nearest",
        intersect: false,
      },
    },
  };

  const chartData = {
    datasets: [
      // Observed MAL — solid blue line, points at left edge of each week column
      {
        type: "line" as const,
        label: "Observed Outcome",
        borderColor: "rgb(30, 90, 200)",
        backgroundColor: "rgba(30, 90, 200, 0.1)",
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: "rgb(30, 90, 200)",
        tension: 0,
        yAxisID: "y-left",
        fill: false,
        data: malObserved,
      },

      // Manual prediction + confidence band
      ...(hasManual
        ? [
            {
              type: "line" as const,
              label: "Manual Schedule Prediction",
              borderColor: "rgb(100, 160, 240)",
              backgroundColor: "rgba(100, 160, 240, 0.1)",
              borderWidth: 1.5,
              borderDash: [5, 5],
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: "rgb(100, 160, 240)",
              tension: 0,
              yAxisID: "y-left",
              fill: false,
              data: malPredicted,
            },
            {
              type: "line" as const,
              label: "Manual Schedule Max Outcome",
              backgroundColor: "rgba(100, 160, 240, 0.15)",
              borderColor: "rgba(100, 160, 240, 0)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              data: malMax,
            },
            {
              type: "line" as const,
              label: "Manual Schedule Min Outcome",
              backgroundColor: "rgba(100, 160, 240, 0.15)",
              borderColor: "rgba(100, 160, 240, 0)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              fill: "-1",
              data: malMin,
            },
          ]
        : []),

      // Dose bars — single dataset, centered in each week's column
      // Dark green = past dose, light green = future dose
      {
        type: "bar" as const,
        label: "Dose Schedule",
        backgroundColor: doseColors,
        borderColor: "white",
        borderWidth: 1,
        yAxisID: "y-right",
        barPercentage: 0.6,
        data: dosePoints,
      },
    ],
  };

  return <Chart type="bar" data={chartData} options={options} />;
}
