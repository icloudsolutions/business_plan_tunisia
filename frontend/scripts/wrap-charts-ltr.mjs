import fs from "fs";

const files = [
  "src/components/finance-live/FinanceKpiCockpit.tsx",
  "src/components/finance-live/BalanceCompositionChart.tsx",
  "src/components/finance-live/TreasuryWaterfallChart.tsx",
  "src/components/finance-live/BfrAreaChart.tsx",
  "src/components/liasse-wizard/PricingCompetitivenessChart.tsx",
  "src/components/liasse-wizard/FinancingStructureDonut.tsx",
  "src/components/liasse-wizard/ProcurementTrendChart.tsx",
  "src/components/liasse-wizard/ProcurementDonutChart.tsx",
  "src/components/liasse-wizard/LoanDualAxisChart.tsx",
  "src/components/liasse-wizard/TvaWaterfallChart.tsx",
  "src/components/liasse-wizard/PayrollCharts.tsx",
  "src/components/liasse-wizard/CostDonutChart.tsx",
  "src/components/scenarios/ScenarioComparisonChart.tsx",
  "src/components/admin/AnalyticsSection.tsx",
  "src/components/finance-live/tabs/InvestmentsTab.tsx",
  "src/components/finance-live/tabs/ResultsTab.tsx",
];

for (const file of files) {
  let c = fs.readFileSync(file, "utf8");
  if (c.includes("ChartLtr")) {
    console.log("skip", file);
    continue;
  }
  if (!c.includes('import ChartLtr')) {
    c = c.replace(
      /} from "recharts";/,
      '} from "recharts";\nimport ChartLtr from "@/components/ui/ChartLtr";'
    );
  }
  c = c.replace(
    /(<div className="h-[^"]+">)\s*\n\s*(<ResponsiveContainer)/g,
    '$1\n        <ChartLtr className="h-full w-full">\n          $2'
  );
  c = c.replace(
    /(\s*<\/ResponsiveContainer>)\s*\n(\s*<\/div>)/g,
    "$1\n        </ChartLtr>\n$2"
  );
  fs.writeFileSync(file, c);
  console.log("updated", file);
}
