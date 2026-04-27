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
  cemPrediction: ModelPrediction;
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

const PredictionSummary: React.FC<PredictionSummaryProps> = ({ pastAvgOut, manualPrediction, cemPrediction }) => {
  const hasManual = manualPrediction.futureAvgOut.length > 0;
  const hasCem = cemPrediction.futureAvgOut.length > 0;
  const nextWeek = to3dp(pastAvgOut.length - 1);
  const manualMal = hasManual ? to3dp(manualPrediction.futureAvgOut[1]) : null;
  const manualHours = hasManual ? to3dp(manualPrediction.futureDoseData[0]) : null;
  const cemMal = hasCem ? to3dp(cemPrediction.futureAvgOut[1]) : null;
  const cemHours = hasCem ? to3dp(cemPrediction.futureDoseData[0]) : null;

  return (
    <div className="my-6 bg-[var(--color-accent)]/10 rounded-lg p-4 shadow-sm">
      <ul className="list-none pl-5 text-[var(--color-foreground)] space-y-1">
        {hasManual ? (
          <li>
            For the next treatment week (<span>week {nextWeek}</span>), the <span className="font-bold">manual schedule</span> plans for <span className="text-[var(--color-primary)] font-bold">{manualHours} treatment hours</span>, with an expected <span className="text-[var(--color-primary)] font-bold">{manualMal} MAL score</span>.
          </li>
        ) : (
          <li>Enter a manual schedule to see predictions for the next treatment week.</li>
        )}
        {hasCem ? (
          <li>
            For the next treatment week (<span>week {nextWeek}</span>), the <span className="font-bold">optimized schedule</span> recommends <span className="text-[var(--color-primary)] font-bold">{cemHours} treatment hours</span>, with an expected <span className="text-[var(--color-primary)] font-bold">{cemMal} MAL score</span>.
          </li>
        ) : (
          <li>Run an optimized prediction to see the recommended schedule for the next treatment week.</li>
        )}
      </ul>
    </div>
  );
};

export default PredictionSummary;
