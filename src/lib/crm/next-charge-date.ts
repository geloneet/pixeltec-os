export function getNextChargeDate(startDate: string, frequency: "monthly" | "annual"): Date {
  const start = new Date(startDate);
  const now = new Date();
  const next = new Date(start);
  if (frequency === "monthly") {
    while (next <= now) next.setMonth(next.getMonth() + 1);
  } else {
    while (next <= now) next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}
