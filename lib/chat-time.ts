/** Display helpers for chat UIs. Always group by the *viewer’s local date*,
 * not UTC day boundaries, so midnight behaves naturally on mobile.
 */
export function sameChatDay(left: string, right: string): boolean {
  const a = new Date(left);
  const b = new Date(right);
  if (!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return false;
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function chatTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
}

export function chatDayLabel(value: string, now: Date = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown date";
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((today - messageDay) / 86_400_000);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo > 1 && daysAgo < 7) {
    return new Intl.DateTimeFormat("en", { weekday: "long" }).format(date);
  }
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" as const }),
  }).format(date);
}
