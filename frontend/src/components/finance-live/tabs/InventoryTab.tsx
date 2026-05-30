"use client";

import InventoryTable from "@/components/finance-live/InventoryTable";
import type { ProjectionPayload } from "@/lib/finance/projections-api";

type Props = {
  data: ProjectionPayload;
};

export default function InventoryTab({ data }: Props) {
  if (!data.inventory) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        <p className="font-medium text-slate-800">Chaîne production / stocks non activée</p>
        <p className="mt-2 max-w-md mx-auto">
          Renseignez <code className="rounded bg-slate-100 px-1">operations.qtySoldY1</code> dans
          la liasse pour activer le calcul Liasse Unique (production → consommation → achats MP).
        </p>
      </div>
    );
  }

  return <InventoryTable inventory={data.inventory} />;
}
