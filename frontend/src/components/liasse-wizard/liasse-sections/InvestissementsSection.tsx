"use client";

import StepInvestments from "../steps/StepInvestments";
import WorkingCapitalFields from "./WorkingCapitalFields";

type Props = { readOnly?: boolean };

export default function InvestissementsSection({ readOnly }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h4 className="mb-3 text-sm font-semibold text-navy-800">Actifs fixes</h4>
        <StepInvestments readOnly={readOnly} />
      </div>
      <WorkingCapitalFields readOnly={readOnly} />
    </div>
  );
}
