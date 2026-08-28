"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getBillingItemsForClient } from "@/lib/documents/billing";
import { listActiveRecurringCharges } from "@/lib/sales/recurring-view";
import { FinanzasTab } from "./FinanzasTab";
import type { BillingItem } from "@/types/documents";
import type { RecurringChargeRow } from "@/lib/sales/recurring-view";

export function FinanzasTabLoader({ clientId }: { clientId: string }) {
  const [data, setData] = useState<{ billingItems: BillingItem[]; recurring: RecurringChargeRow[] } | null>(null);

  const load = useCallback(async () => {
    const [billingItems, recurring] = await Promise.all([
      getBillingItemsForClient(clientId),
      listActiveRecurringCharges(clientId),
    ]);
    setData({ billingItems, recurring });
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (data === null) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return <FinanzasTab billingItems={data.billingItems} recurring={data.recurring} />;
}
