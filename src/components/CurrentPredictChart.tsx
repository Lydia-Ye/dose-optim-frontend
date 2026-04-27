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

interface SmoothBand {
  mean: number[];
  p05:  number[];
  p95:  number[];
}

interface ChartProps {
  pastAvgOut: number[];
  pastDoseData: number[];
  manualPrediction: ModelPrediction;
  horizon: number;
  smoothBand?: SmoothBand;
  yLabel?: string;
}

const MAL_HIDDEN = ["Manual Schedule Max Outcome", "Manual Schedule Min Outcome"];

export default function CurrentPredictChart({
  pastAvgOut,
  pastDoseData,
  manualPrediction,
  horizon,
  smoothBand,
  yLabel = "MAL Score",
}: ChartProps) {
  const showSmooth = !!(smoothBand?.mean?.length);
  // Short metric name for labels, e.g. "UEFM Score" → "UEFM"
  const metric = yLabel.replace(" Score", "");
  const smoothBandUpperLabel = `${metric} 95th Percentile`;
  const smoothBandLowerLabel = `${metric} 5th Percentile`;
  const hiddenLegend = [...MAL_HIDDEN, smoothBandUpperLabel, smoothBandLowerLabel];

  if (!showSmooth && (!pastAvgOut || pastAvgOut.length === 0)) {
    return <p className="mt-20 mb-80 text-center text-[var(--color-warning)]">Please upload patient data for visualization.</p>;
  }

  const n = pastAvgOut.length;
  const hasManual = manualPrediction.futureAvgOut.length > 0;
  const lastObserved = pastAvgOut.at(-1) ?? 0;

  // --- MAL mode: observed line + optional prediction band ---
  const malObserved = pastAvgOut.map((y, w) => ({ x: w, y }));

  const malPredicted = (!showSmooth && hasManual)
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: manualPrediction.futureAvgOut[n + i] ?? null,
        })),
      ]
    : [];

  const malMax = (!showSmooth && hasManual)
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: manualPrediction.maxOut[n + i] ?? null,
        })),
      ]
    : [];

  const malMin = (!showSmooth && hasManual)
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: manualPrediction.minOut[n + i] ?? null,
        })),
      ]
    : [];

  // --- Smooth band mode: full-horizon trajectory (UEFM / WMFT) ---
  const smoothMain  = showSmooth ? smoothBand!.mean.map((y, w) => ({ x: w, y })) : [];
  const smoothUpper = showSmooth ? smoothBand!.p95.map((y, w)  => ({ x: w, y })) : [];
  const smoothLower = showSmooth ? smoothBand!.p05.map((y, w)  => ({ x: w, y })) : [];

  const yAxisMax = showSmooth
    ? Math.ceil(Math.max(...smoothBand!.p95.filter(isFinite)) * 1.1) || 10
    : 5;

  // --- Dose bars ---
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
        min: -0.5,
        max: xMax + 0.5,
        title: { display: true, text: "Treatment Week" },
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
        title: { display: true, text: yLabel },
        min: 0,
        max: yAxisMax,
        ticks: showSmooth ? { maxTicksLimit: 8 } : { stepSize: 1 },
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
          filter: (legendItem) => !hiddenLegend.includes(legendItem.text),
          boxWidth: 16,
          padding: 12,
          font: { size: 12 },
          usePointStyle: true,
        },
      },
      tooltip: {
        mode: "nearest",
        intersect: false,
        callbacks: {
          title: (items) => {
            if (items.length === 0) return '';
            const x = items[0].parsed.x;
            return `Week ${Math.floor(x)}`;
          },
        },
      },
    },
  };

  const chartData = {
    datasets: [
      // --- Smooth band mode (UEFM / WMFT) ---
      ...(showSmooth
        ? [
            {
              type: "line" as const,
              label: `${metric} Mean Trajectory`,
              borderColor: "rgb(30, 90, 200)",
              backgroundColor: "rgba(30, 90, 200, 0.1)",
              borderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: "rgb(30, 90, 200)",
              tension: 0,
              yAxisID: "y-left",
              fill: false,
              data: smoothMain,
            },
            {
              type: "line" as const,
              label: smoothBandUpperLabel,
              borderColor: "rgba(30, 90, 200, 0)",
              backgroundColor: "rgba(30, 90, 200, 0.12)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              data: smoothUpper,
            },
            {
              type: "line" as const,
              label: smoothBandLowerLabel,
              borderColor: "rgba(30, 90, 200, 0)",
              backgroundColor: "rgba(30, 90, 200, 0.12)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              fill: "-1",
              data: smoothLower,
            },
          ]
        : [
            // --- MAL mode: observed + optional manual prediction ---
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
          ]),

      // --- Dose bars (always shown) ---
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
