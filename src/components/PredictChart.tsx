"use client"

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
  ScatterController,
  Filler,
  ChartData,
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
  ScatterController,
  Filler
);

interface ChartProps {
  data: ChartData<"line" | "bar">;
}

export default function PredictChart({ data }: ChartProps) {
  // Compute max dose across all bar datasets for dynamic y-right scaling
  const maxDose = data.datasets
    .filter(d => d.type === "bar")
    .flatMap(d => (d.data as number[]).filter(v => v != null))
    .reduce((m, v) => Math.max(m, v), 0);
  const yRightMax = Math.ceil(maxDose * 1.2) || 10;

  const options: ChartOptions<"line" | "bar"> = {
    scales: {
      x: {
        display: true,
        title: { display: true, text: "Treatment Week" },
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
        max: yRightMax,
        grid: { drawOnChartArea: false },
      },
    },
    plugins: {
      legend: {
        labels: {
          filter: (legendItem) =>
            !["Manual Schedule Max Outcome", "Manual Schedule Min Outcome", "Manual Schedule Dose"].includes(legendItem.text),
          boxWidth: 16,
          padding: 12,
          font: { size: 12 },
          usePointStyle: true,
        },
      },
      tooltip: { mode: "index", intersect: false },
    },
  };

  const chartData = {
    ...data,
    labels: data.labels?.map((_, index) => index + 1),
    datasets: data.datasets.map(dataset => {
      if (dataset.type === 'line') {
        const d = dataset as Record<string, unknown>;
        return {
          ...dataset,
          borderWidth: 1.5,
          pointRadius:      d.pointRadius      ?? 0,
          pointHoverRadius: d.pointHoverRadius ?? 4,
          tension: d.showLine === false ? 0 : (typeof d.tension === "number" ? d.tension : 0.4),
        };
      }
      return dataset;
    }),
  };

  return <Chart type="bar" data={chartData} options={options} />;
}
