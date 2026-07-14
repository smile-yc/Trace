import { API_BASE } from "../constants";
import type { ReportReview, ReportReviewInput, ReportReviewType } from "../types";

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message || "复盘内容请求失败");
  }
  return response.json() as Promise<T>;
}

export async function fetchReportReview(reportType: ReportReviewType, periodKey: string): Promise<ReportReview | null> {
  const query = new URLSearchParams({ reportType, periodKey });
  const response = await fetch(`${API_BASE}/api/report-reviews?${query}`);
  return (await readJson<{ review: ReportReview | null }>(response)).review;
}

export async function saveReportReview(input: ReportReviewInput): Promise<ReportReview> {
  const response = await fetch(`${API_BASE}/api/report-reviews`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input)
  });
  return (await readJson<{ review: ReportReview }>(response)).review;
}
