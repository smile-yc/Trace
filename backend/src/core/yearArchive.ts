import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { getDatabasePath, listOutcomes, listRecords, listReportReviews } from "../database.js";

export interface YearArchivePreview {
  year: number;
  recordCount: number;
  outcomeCount: number;
  reportReviewCount: number;
}

export interface YearArchiveResult extends YearArchivePreview {
  filePath: string;
  createdAt: string;
}

function assertYear(year: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("YEAR_ARCHIVE_INVALID");
}

function outcomeBelongsToYear(outcome: { startDate: string; updateDate: string; completedDate: string; createTime: number }, year: number): boolean {
  const prefix = `${year}-`;
  const date = outcome.completedDate || outcome.updateDate || outcome.startDate || new Date(outcome.createTime).toISOString().slice(0, 10);
  return date.startsWith(prefix);
}

function collectYearData(year: number) {
  assertYear(year);
  const prefix = `${year}-`;
  const records = listRecords().filter((record) => record.date.startsWith(prefix));
  const outcomes = listOutcomes({ includeArchived: true }).filter((outcome) => outcomeBelongsToYear(outcome, year));
  const reportReviews = [
    ...listReportReviews("year", String(year)),
    ...listReportReviews("month", prefix),
    ...listReportReviews("week", prefix)
  ];
  return { records, outcomes, reportReviews };
}

export function previewYearArchive(year: number): YearArchivePreview {
  const data = collectYearData(year);
  return {
    year,
    recordCount: data.records.length,
    outcomeCount: data.outcomes.length,
    reportReviewCount: data.reportReviews.length
  };
}

export function createYearArchive(year: number): YearArchiveResult {
  const data = collectYearData(year);
  const createdAt = new Date().toISOString();
  const archive = {
    manifest: {
      app: "Trace",
      archiveType: "year",
      formatVersion: 1,
      year,
      createdAt
    },
    ...data
  };
  const archiveDir = path.join(path.dirname(getDatabasePath()), "archives");
  fs.mkdirSync(archiveDir, { recursive: true });
  const filePath = path.join(archiveDir, `trace-year-${year}-${createdAt.replace(/[:.]/g, "-")}.json.gz`);
  fs.writeFileSync(filePath, gzipSync(Buffer.from(JSON.stringify(archive), "utf8")));
  return {
    ...previewYearArchive(year),
    filePath,
    createdAt
  };
}
