const pad = (value: number) => String(value).padStart(2, "0");

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function shiftDate(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function shiftMonth(dateKey: string, months: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return toDateKey(date);
}

export function shiftYear(dateKey: string, years: number): string {
  const date = parseDateKey(dateKey);
  date.setFullYear(date.getFullYear() + years);
  return toDateKey(date);
}

export function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  if (!month || !day) return dateKey;
  return `${Number(month)}月${Number(day)}日`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  if (!year || !month) return monthKey;
  return `${year}年${Number(month)}月`;
}

export function getWeekRange(dateKey: string): { start: string; end: string } {
  const date = parseDateKey(dateKey);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start: toDateKey(start), end: toDateKey(end) };
}

export function getWeekNumber(dateKey: string): number {
  const date = parseDateKey(dateKey);
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDays = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  return Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
}

export function getMonthRange(dateKey: string): { start: string; end: string; monthKey: string } {
  const date = parseDateKey(dateKey);
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const key = `${year}-${pad(month + 1)}`;
  return { start: toDateKey(start), end: toDateKey(end), monthKey: key };
}

export function getYearRange(dateKey: string): { start: string; end: string; year: string } {
  const year = String(parseDateKey(dateKey).getFullYear());
  return { start: `${year}-01-01`, end: `${year}-12-31`, year };
}

export function inRange(dateKey: string, start: string, end: string): boolean {
  return dateKey >= start && dateKey <= end;
}
