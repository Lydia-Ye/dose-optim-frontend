"use client";

import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  BarController,
  ChartOptions,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import BandChart, { BandData } from "./BandChart";

ChartJS.register(LinearScale, CategoryScale, BarElement, BarController);

interface ModelDetailPanelsProps {
  malSmooth:  BandData;
  uefmSmooth: BandData;
  wmftSmooth: BandData;
  mal:        BandData;
  uefm:       BandData;
  wmft:       BandData;
  s:          BandData;
  rM:         BandData;
  dosage:     number[];
}

const COLORS = {
  mal:  { color: "rgb(31,119,180)",  fillColor: "rgba(31,119,180,0.15)"  },
  uefm: { color: "rgb(255,127,14)",  fillColor: "rgba(255,127,14,0.15)"  },
  wmft: { color: "rgb(44,160,44)",   fillColor: "rgba(44,160,44,0.15)"   },
  s:    { color: "rgb(148,103,189)", fillColor: "rgba(148,103,189,0.15)" },
  rM:   { color: "rgb(140,86,75)",   fillColor: "rgba(140,86,75,0.15)"   },
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 text-center">{title}</p>
      {children}
    </div>
  );
}

export default function ModelDetailPanels({
  malSmooth, uefmSmooth, wmftSmooth,
  mal, uefm, wmft,
  s, rM, dosage,
}: ModelDetailPanelsProps) {
  const weeks = Array.from({ length: mal.mean.length }, (_, i) => i);

  // Dose bars: pad with leading 0 so length matches predictions (Ntime+1)
  const doseBars = [0, ...dosage].slice(0, weeks.length);

  const doseBarOptions: ChartOptions<"bar"> = {
    animation: false,
    responsive: true,
    scales: {
      x: { title: { display: true, text: "Week" }, ticks: { maxTicksLimit: 8 } },
      y: { title: { display: true, text: "h/wk" }, min: 0 },
    },
    plugins: {
      legend: { labels: { boxWidth: 12, font: { size: 10 } } },
      tooltip: { mode: "index", intersect: false },
    },
  };

  const doseBarData = {
    labels: weeks,
    datasets: [{
      type: "bar" as const,
      label: "Dose (h/wk)",
      data: doseBars,
      backgroundColor: "rgba(127,127,127,0.7)",
    }],
  };

  return (
    <div className="mt-8 space-y-4">
      {/* Row labels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1 px-1">
        <p className="text-xs text-center text-gray-400 italic lg:col-span-3">
          Row 1 — smooth mean (epistemic uncertainty only) · Row 2 — simulated observations (epistemic + noise) · Row 3 — latent states
        </p>
      </div>

      {/* Row 0: smooth means */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="MAL — smooth mean (0–5)">
          <BandChart weeks={weeks} band={malSmooth} {...COLORS.mal} label="MAL mean μ" yLabel="MAL (0–5)" yMin={0} yMax={5} />
        </Panel>
        <Panel title="UEFM — smooth mean (0–66)">
          <BandChart weeks={weeks} band={uefmSmooth} {...COLORS.uefm} label="UEFM mean μ" yLabel="UEFM (0–66)" yMin={0} yMax={66} />
        </Panel>
        <Panel title="WMFT — smooth mean (0–1)">
          <BandChart weeks={weeks} band={wmftSmooth} {...COLORS.wmft} label="WMFT mean μ" yLabel="WMFT (0–1)" yMin={0} yMax={1} />
        </Panel>
      </div>

      {/* Row 1: noisy observations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="MAL — observed (0–5)">
          <BandChart weeks={weeks} band={mal} {...COLORS.mal} label="MAL obs" yLabel="MAL (0–5)" yMin={0} yMax={5} />
        </Panel>
        <Panel title="UEFM — observed (0–66)">
          <BandChart weeks={weeks} band={uefm} {...COLORS.uefm} label="UEFM obs" yLabel="UEFM (0–66)" yMin={0} yMax={66} />
        </Panel>
        <Panel title="WMFT — observed (0–1)">
          <BandChart weeks={weeks} band={wmft} {...COLORS.wmft} label="WMFT obs" yLabel="WMFT (0–1)" yMin={0} yMax={1} />
        </Panel>
      </div>

      {/* Row 2: latent states + dose */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="s — structural recovery">
          <BandChart weeks={weeks} band={s} {...COLORS.s} label="s" yLabel="Latent state" yMin={0} yMax={1} />
        </Panel>
        <Panel title="r_m — motor memory">
          <BandChart weeks={weeks} band={rM} {...COLORS.rM} label="r_m" yLabel="Latent state" />
        </Panel>
        <Panel title="Dose schedule">
          <Chart type="bar" data={doseBarData} options={doseBarOptions} />
        </Panel>
      </div>
    </div>
  );
}
