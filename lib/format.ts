export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  const precision = exponent === 0 ? 0 : value >= 100 ? 0 : decimals;

  return `${value.toFixed(precision)} ${units[exponent]}`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return "—";
  const total = Math.round(minutes);
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins.toString().padStart(2, "0")}m`;
  return `${mins}m`;
}

export function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "—";
  return formatMinutes(seconds / 60);
}

export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return "—";
  return grams >= 100 ? `${Math.round(grams)} g` : `${grams.toFixed(1)} g`;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
