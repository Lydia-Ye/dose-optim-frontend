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

const options: ChartOptions<"line" | "bar"> = {
  scales: {
    x: {
      display: true,
      title: {
        display: true,
        text: "Treatment Week"
      }
    },
    "y-left": {
      type: "linear",
      display: true,
      position: "left",
      title: {
        display: true,
        text: "MAL Score",
      },
      min: 0,
      max: 5,
      ticks: { stepSize: 1 },
    },
    "y-right": {
      type: "linear",
      display: true,
      position: "right",
      title: {
        display: true,
        text: "Treatment Hours",
      },
      min: 0,
      max: 12,
      grid: {
        drawOnChartArea: false,
      },
    },
  },
  plugins: {
    legend: {
      labels: {
        filter: (legendItem) => {
          return !["Manual Schedule Max Outcome", "Manual Schedule Min Outcome", "Manual Schedule Dose"].includes(legendItem.text);
        },
        boxWidth: 16,
        padding: 12,
        font: {
          size: 12,
        },
        usePointStyle: true,
      },
    },
    tooltip: {
      mode: "index",
      intersect: false,
    },
  },
};

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

  const lastObserved = pastAvgOut.at(-1) ?? 0;

  const chartData = {
    labels: [
      ...pastAvgOut.map((_, index) => index * 2),
      ...Array(horizon - pastAvgOut.length + 1).fill(0).map((_, index) => (index + pastAvgOut.length) * 2)
    ],
    datasets: [
      // Observed Outcome (solid blue)
      {
        type: "line" as const,
        label: "Observed Outcome",
        borderColor: "rgb(65, 105, 225)",
        backgroundColor: "rgba(65, 105, 225, 0.1)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        yAxisID: "y-left",
        fill: false,
        data: pastAvgOut,
      },

      // Manual
      ...(manualPrediction.futureAvgOut.length > 0 ? [
        {
          type: "line" as const,
          label: "Manual Schedule Prediction",
          borderColor: "rgb(255, 0, 170)",
          backgroundColor: "rgba(255, 0, 170, 0.1)",
          borderWidth: 1.5,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          yAxisID: "y-left",
          fill: false,
          data: [
            ...Array(pastAvgOut.length - 1).fill(null),
            lastObserved,
            ...manualPrediction.futureAvgOut
          ],
        },
        {
          type: "line" as const,
          label: "Manual Schedule Max Outcome",
          backgroundColor: "rgba(255, 0, 170, 0.2)",
          borderColor: "rgba(255, 0, 170, 0)",
          pointRadius: 0,
          pointHoverRadius: 0,
          yAxisID: "y-left",
          data: [
            ...Array(pastAvgOut.length - 1).fill(null),
            lastObserved,
            ...manualPrediction.maxOut
          ],
        },
        {
          type: "line" as const,
          label: "Manual Schedule Min Outcome",
          backgroundColor: "rgba(255, 0, 170, 0.2)",
          borderColor: "rgba(255, 0, 170, 0)",
          pointRadius: 0,
          pointHoverRadius: 0,
          yAxisID: "y-left",
          fill: "-1",
          data: [
            ...Array(pastAvgOut.length - 1).fill(null),
            lastObserved,
            ...manualPrediction.minOut
          ],
        },
        {
          type: "bar" as const,
          label: "Manual Schedule Dose",
          backgroundColor: "rgba(255, 0, 170, 0.5)",
          borderColor: "white",
          yAxisID: "y-right",
          data: [
            ...Array(pastAvgOut.length - 1).fill(null),
            ...manualPrediction.futureDoseData
          ],
        }
      ] : []),

      // Past Dose
      {
        type: "bar" as const,
        label: "Past Dose",
        backgroundColor: "rgb(58, 218, 55)",
        borderColor: "white",
        yAxisID: "y-right",
        data: pastDoseData.slice(0, pastAvgOut.length - 1),
      },
    ],
  };

  return <Chart type="bar" data={chartData} options={options} />;
}
