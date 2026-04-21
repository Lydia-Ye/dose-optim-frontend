import React from "react";

interface ModelPrediction {
  maxOut: number[];
  futureAvgOut: number[];
  minOut: number[];
  futureDoseData: number[];
}

interface PredictionSummaryProps {
  pastAvgOut: number[];
  manualPrediction: ModelPrediction;
}

function to3dp(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "-";
  const str = String(val);
  const [, decPart] = str.split(".");
  if (decPart && decPart.length > 3) {
    return Number(val).toFixed(3);
  }
  return str;
}

const PredictionSummary: React.FC<PredictionSummaryProps> = ({ pastAvgOut, manualPrediction }) => {
  const hasManual = manualPrediction.futureAvgOut.length > 0;
  const nextWeek = to3dp(pastAvgOut.length * 2);
  const manualMal = hasManual ? to3dp(manualPrediction.futureAvgOut[1]) : null;
  const manualHours = hasManual ? to3dp(manualPrediction.futureDoseData[0]) : null;

  return (
    <div className="my-6 bg-[var(--color-accent)]/10 rounded-lg p-4 shadow-sm">
      <ul className="list-none pl-5 text-[var(--color-foreground)] space-y-1">
        {hasManual ? (
          <li>
            For the next treatment week (<span>week {nextWeek}</span>), the <span className="font-bold">manual schedule</span> plans for <span className="text-[var(--color-primary)] font-bold">{manualHours} treatment hours</span>, with an expected <span className="text-[var(--color-primary)] font-bold">{manualMal} MAL score</span>.
          </li>
        ) : (
          <li>Enter a manual schedule above to see predictions for the next treatment week.</li>
        )}
      </ul>
    </div>
  );
};

export default PredictionSummary;
