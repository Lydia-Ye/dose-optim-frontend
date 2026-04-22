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
    }
  }
};

interface ChartProps {
  data: ChartData<"line" | "bar">;
}

export default function PredictChart({ data }: ChartProps) {
  const chartData = {
    ...data,
    labels: data.labels?.map((_, index) => index * 2),
    datasets: data.datasets.map(dataset => {
      if (dataset.type === 'line') {
        return {
          ...dataset,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
        };
      }
      return dataset;
    })
  };

  return <Chart type="bar" data={chartData} options={options} />;
}
