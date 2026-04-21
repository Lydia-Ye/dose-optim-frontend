"use client";

import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  Filler,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, Legend, Tooltip, Filler);

export interface BandData {
  mean: number[];
  p05:  number[];
  p95:  number[];
}

interface BandChartProps {
  weeks: number[];
  band: BandData;
  color: string;       // solid line + border, e.g. "rgb(31,119,180)"
  fillColor: string;   // band fill,          e.g. "rgba(31,119,180,0.18)"
  label: string;
  yLabel: string;
  yMin?: number;
  yMax?: number;
}

export default function BandChart({
  weeks, band, color, fillColor, label, yLabel, yMin, yMax,
}: BandChartProps) {
  const options: ChartOptions<"line"> = {
    animation: false,
    responsive: true,
    scales: {
      x: {
        title: { display: true, text: "Week" },
        ticks: { maxTicksLimit: 8 },
      },
      y: {
        title: { display: true, text: yLabel },
        min: yMin,
        max: yMax,
      },
    },
    plugins: {
      legend: {
        labels: {
          filter: (item) => !["_p95", "_p05"].includes(item.text ?? ""),
          boxWidth: 12,
          font: { size: 10 },
        },
      },
      tooltip: { mode: "index", intersect: false },
    },
  };

  const chartData = {
    labels: weeks,
    datasets: [
      {
        label: "_p95",
        data: band.p95,
        borderColor: "transparent",
        backgroundColor: fillColor,
        pointRadius: 0,
        tension: 0.4,
        fill: false as const,
      },
      {
        label: "_p05",
        data: band.p05,
        borderColor: "transparent",
        backgroundColor: fillColor,
        pointRadius: 0,
        tension: 0.4,
        fill: "-1" as const,
      },
      {
        label,
        data: band.mean,
        borderColor: color,
        backgroundColor: "transparent",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false as const,
      },
    ],
  };

  return <Line data={chartData} options={options} />;
}
