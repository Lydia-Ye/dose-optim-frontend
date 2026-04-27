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
  ChartOptions,
  Scale
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
  pastAvgOut: (number | null)[];
  pastDoseData: number[];
  manualPrediction: ModelPrediction;
  horizon: number;
  smoothBand?: SmoothBand;
  cemPrediction?: ModelPrediction;
  cemSmoothBand?: SmoothBand;
  yLabel?: string;
  yMax?: number;
  doseBarPercentage?: number;
  doseBarThickness?: number;
}

const MAL_HIDDEN = [
  "Manual Schedule Max Outcome", "Manual Schedule Min Outcome",
  "CEM Max Outcome", "CEM Min Outcome",
];
const PREDICTION_BLUE   = "rgb(100, 160, 240)";
const PREDICTION_BLUE_FILL = "rgba(100, 160, 240, 0.1)";
const CEM_PURPLE        = "rgb(147, 51, 234)";
const CEM_PURPLE_FILL   = "rgba(147, 51, 234, 0.10)";

export default function CurrentPredictChart({
  pastAvgOut,
  pastDoseData,
  manualPrediction,
  horizon,
  smoothBand,
  cemPrediction,
  cemSmoothBand,
  yLabel = "MAL Score",
  yMax,
  doseBarPercentage = 0.9,
  doseBarThickness,
}: ChartProps) {
  const showSmooth = !!(smoothBand?.mean?.length);
  const showCemSmooth = !!(cemSmoothBand?.mean?.length);
  // Short metric name for labels, e.g. "UEFM Score" → "UEFM"
  const metric = yLabel.replace(" Score", "");
  const smoothBandUpperLabel = `${metric} 95th Percentile`;
  const smoothBandLowerLabel = `${metric} 5th Percentile`;
  const cemSmoothUpperLabel  = `CEM ${metric} 95th Percentile`;
  const cemSmoothLowerLabel  = `CEM ${metric} 5th Percentile`;
  const hiddenLegend = [
    ...MAL_HIDDEN,
    smoothBandUpperLabel, smoothBandLowerLabel,
    cemSmoothUpperLabel,  cemSmoothLowerLabel,
  ];

  const hasObservedOutcome = pastAvgOut?.some((y) => y != null && Number.isFinite(y));

  if (!showSmooth && !showCemSmooth && !hasObservedOutcome) {
    return <p className="mt-20 mb-80 text-center text-[var(--color-warning)]">Please upload patient data for visualization.</p>;
  }

  const n = pastAvgOut.length;
  const hasManual = manualPrediction.futureAvgOut.length > 0;
  const hasCem    = (cemPrediction?.futureAvgOut.length ?? 0) > 0;
  const lastObserved = [...pastAvgOut].reverse().find((y) => y != null && Number.isFinite(y)) ?? 0;

  // --- MAL mode: observed line + optional prediction bands ---
  const malObserved = pastAvgOut
    .map((y, w) => (y != null && Number.isFinite(y) ? { x: w, y } : null))
    .filter((point): point is { x: number; y: number } => point !== null);

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

  // --- CEM MAL mode ---
  const cemMalPredicted = (!showSmooth && hasCem)
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: cemPrediction!.futureAvgOut[n + i] ?? null,
        })),
      ]
    : [];

  const cemMalMax = (!showSmooth && hasCem)
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: cemPrediction!.maxOut[n + i] ?? null,
        })),
      ]
    : [];

  const cemMalMin = (!showSmooth && hasCem)
    ? [
        { x: n - 1, y: lastObserved },
        ...Array.from({ length: horizon - n + 1 }, (_, i) => ({
          x: n + i,
          y: cemPrediction!.minOut[n + i] ?? null,
        })),
      ]
    : [];

  // --- Smooth band mode: full-horizon trajectory (UEFM / WMFT) ---
  const smoothMain  = showSmooth ? smoothBand!.mean.map((y, w) => ({ x: w, y })) : [];
  const smoothUpper = showSmooth ? smoothBand!.p95.map((y, w)  => ({ x: w, y })) : [];
  const smoothLower = showSmooth ? smoothBand!.p05.map((y, w)  => ({ x: w, y })) : [];

  const cemSmoothMain  = showCemSmooth ? cemSmoothBand!.mean.map((y, w) => ({ x: w, y })) : [];
  const cemSmoothUpper = showCemSmooth ? cemSmoothBand!.p95.map((y, w)  => ({ x: w, y })) : [];
  const cemSmoothLower = showCemSmooth ? cemSmoothBand!.p05.map((y, w)  => ({ x: w, y })) : [];

  const allP95 = [
    ...(showSmooth    ? smoothBand!.p95    : []),
    ...(showCemSmooth ? cemSmoothBand!.p95 : []),
  ].filter(isFinite);
  const yAxisMax = (showSmooth || showCemSmooth)
    ? Math.ceil(Math.max(...allP95) * 1.1) || 10
    : (yMax ?? 5);

  // --- Dose bars ---
  const xMax = Math.max(horizon, pastDoseData.length);
  const dosePoints: { x: number; y: number | null }[] = [];
  const doseColors: string[] = [];
  const hasFutureSchedule = hasManual || hasCem;
  const futureDoseSource = hasManual
    ? manualPrediction.futureDoseData
    : hasCem ? cemPrediction!.futureDoseData : [];
  for (let w = 0; w < xMax; w++) {
    const isPast = hasFutureSchedule ? w < n - 1 : w < pastDoseData.length;
    dosePoints.push({
      x: w + 0.5,
      y: isPast
        ? (pastDoseData[w] ?? null)
        : (hasFutureSchedule ? (futureDoseSource[w] ?? null) : null),
    });
    doseColors.push(isPast ? "rgb(34, 139, 34)" : "rgba(134, 210, 134, 0.8)");
  }

  // CEM future dose bars — only built when both manual and CEM are active
  const cemDosePoints: { x: number; y: number | null }[] = [];
  if (hasManual && hasCem) {
    for (let w = 0; w < xMax; w++) {
      cemDosePoints.push({
        x: w + 0.5,
        y: w < n - 1 ? null : (cemPrediction!.futureDoseData[w] ?? null),
      });
    }
  }

  const maxDose = [...dosePoints, ...cemDosePoints].reduce((max, point) => {
    return point.y != null && Number.isFinite(point.y) ? Math.max(max, point.y) : max;
  }, 0);
  const yRightMax = Math.ceil(maxDose * 2) || 12;

  const options: ChartOptions<"line" | "bar"> = {
    scales: {
      x: {
        type: "linear",
        min: -0.5,
        max: xMax + 0.5,
        title: { display: true, text: "Treatment Week" },
        afterBuildTicks: (axis: Scale) => {
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
        ticks: showSmooth
          ? { maxTicksLimit: 8 }
          : { maxTicksLimit: 8, ...(yAxisMax <= 5 ? { stepSize: 1 } : {}) },
      },
      "y-right": {
        type: "linear",
        display: true,
        position: "right",
        title: { display: true, text: "Treatment Hours" },
        min: 0,
        max: yRightMax,
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
              borderColor: PREDICTION_BLUE,
              backgroundColor: PREDICTION_BLUE_FILL,
              borderWidth: 2,
              borderDash: [2, 5],
              borderCapStyle: "round" as const,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: PREDICTION_BLUE,
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
        : showCemSmooth
        ? [] // CEM-only smooth mode: no manual datasets, no observed line
        : [
            // --- MAL mode: observed + optional manual prediction ---
            {
              type: "line" as const,
              label: `Observed ${metric}`,
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

      // --- CEM overlay ---
      ...(showCemSmooth
        ? [
            {
              type: "line" as const,
              label: "CEM Mean Trajectory",
              borderColor: CEM_PURPLE,
              backgroundColor: CEM_PURPLE_FILL,
              borderWidth: 2,
              borderDash: [2, 5],
              borderCapStyle: "round" as const,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: CEM_PURPLE,
              tension: 0,
              yAxisID: "y-left",
              fill: false,
              data: cemSmoothMain,
            },
            {
              type: "line" as const,
              label: cemSmoothUpperLabel,
              borderColor: "rgba(147, 51, 234, 0)",
              backgroundColor: "rgba(147, 51, 234, 0.12)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              data: cemSmoothUpper,
            },
            {
              type: "line" as const,
              label: cemSmoothLowerLabel,
              borderColor: "rgba(147, 51, 234, 0)",
              backgroundColor: "rgba(147, 51, 234, 0.12)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              fill: "-1",
              data: cemSmoothLower,
            },
          ]
        : hasCem
        ? [
            {
              type: "line" as const,
              label: "CEM Schedule Prediction",
              borderColor: CEM_PURPLE,
              backgroundColor: CEM_PURPLE_FILL,
              borderWidth: 1.5,
              borderDash: [5, 5],
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: CEM_PURPLE,
              tension: 0,
              yAxisID: "y-left",
              fill: false,
              data: cemMalPredicted,
            },
            {
              type: "line" as const,
              label: "CEM Max Outcome",
              backgroundColor: CEM_PURPLE_FILL,
              borderColor: "rgba(147, 51, 234, 0)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              data: cemMalMax,
            },
            {
              type: "line" as const,
              label: "CEM Min Outcome",
              backgroundColor: CEM_PURPLE_FILL,
              borderColor: "rgba(147, 51, 234, 0)",
              pointRadius: 0,
              pointHoverRadius: 0,
              yAxisID: "y-left",
              fill: "-1",
              data: cemMalMin,
            },
          ]
        : []),

      // --- Dose bars ---
      {
        type: "bar" as const,
        label: hasManual && hasCem ? "Manual Dose Schedule" : "Dose Schedule",
        backgroundColor: doseColors,
        borderColor: "white",
        borderWidth: 1,
        yAxisID: "y-right",
        barPercentage: doseBarPercentage,
        ...(doseBarThickness != null ? { barThickness: doseBarThickness } : {}),
        data: dosePoints,
      },
      ...(hasManual && hasCem ? [{
        type: "bar" as const,
        label: "CEM Dose Schedule",
        backgroundColor: "rgba(147, 51, 234, 0.5)",
        borderColor: "white",
        borderWidth: 1,
        yAxisID: "y-right",
        barPercentage: doseBarPercentage,
        ...(doseBarThickness != null ? { barThickness: doseBarThickness } : {}),
        data: cemDosePoints,
      }] : []),
    ],
  };

  return <Chart type="bar" data={chartData} options={options} />;
}
