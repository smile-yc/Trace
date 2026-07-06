import fs from "node:fs";
import PDFDocument from "pdfkit";
import { analyzeExport, sortRecordsForExport, type ExportSummaryItem } from "./analysis.js";
import { formatDate } from "../report.js";
import type { ExportPayload } from "../types.js";

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildRecordMeta(record: ExportPayload["records"][number]): string {
  const items = [
    `日期：${formatDate(record.date)}`,
    `业务：${record.businessCategory || "其他"}`,
    `工作类型：${record.workType || "其他项"}`,
    record.abilityDimension ? `能力：${record.abilityDimension}` : "",
    record.projectName ? `项目：${record.projectName}` : "",
    record.productSystem ? `产品：${record.productSystem}` : "",
    record.subtask ? `子任务：${record.subtask}` : "",
    record.workload !== null && record.workload !== undefined ? `当量：${formatMetric(record.workload)}` : "",
    record.timeHours !== null && record.timeHours !== undefined ? `时间：${formatMetric(record.timeHours)}h` : "",
    record.tags ? `标签：${record.tags}` : ""
  ].filter(Boolean);

  return items.join("  |  ");
}

function findChineseFont(): string | null {
  const candidates = [
    process.env.PDF_FONT_PATH,
    "C:\\Windows\\Fonts\\simhei.ttf",
    "C:\\Windows\\Fonts\\msyh.ttc",
    "C:\\Windows\\Fonts\\simsun.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc"
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function ensureSpace(doc: PDFKit.PDFDocument, height = 100): void {
  if (doc.y > doc.page.height - doc.page.margins.bottom - height) doc.addPage();
}

function drawSectionTitle(doc: PDFKit.PDFDocument, text: string, width: number): void {
  ensureSpace(doc, 80);
  doc.moveDown(0.7);
  doc.fillColor("#2b2926").fontSize(15).text(text, { width });
  doc.moveDown(0.25);
  doc.strokeColor("#d8c9b6").moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.7);
}

function drawSummaryRows(doc: PDFKit.PDFDocument, title: string, rows: ExportSummaryItem[], width: number): void {
  ensureSpace(doc, 90);
  doc.fillColor("#2b2926").fontSize(12).text(title, { width });
  doc.moveDown(0.25);

  if (!rows.length) {
    doc.fillColor("#786d62").fontSize(9).text("暂无数据", { width, indent: 12 });
    doc.moveDown(0.5);
    return;
  }

  rows.slice(0, 8).forEach((item, index) => {
    ensureSpace(doc, 34);
    doc
      .fillColor("#4f4a43")
      .fontSize(9.5)
      .text(`${index + 1}. ${item.label}：${item.count} 条，${formatMetric(item.workload)} 当量，${formatMetric(item.timeHours)} 小时，占比 ${item.ratio}%`, {
        width,
        indent: 12
      });
  });
  doc.moveDown(0.5);
}

export async function buildPdf(payload: ExportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: payload.title,
        Author: "Trace Work Report"
      }
    });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fontPath = findChineseFont();
    if (fontPath) {
      try {
        doc.registerFont("report-font", fontPath);
        doc.font("report-font");
      } catch {
        doc.font("Helvetica");
      }
    } else {
      doc.font("Helvetica");
    }

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const analysis = analyzeExport(payload.records);
    const sortedRecords = sortRecordsForExport(payload.records);
    const scopeText = payload.scope?.label ? `导出范围：${payload.scope.label}` : "导出范围：当前记录";
    const dateText = analysis.dateStart
      ? `统计周期：${formatDate(analysis.dateStart)} 至 ${formatDate(analysis.dateEnd)}`
      : "统计周期：暂无记录";

    doc.fillColor("#2b2926").fontSize(20).text(payload.title, { align: "center", width });
    doc.moveDown(0.45);
    doc.fillColor("#6f665e").fontSize(10).text(`${scopeText}    ${dateText}`, { align: "center", width });

    drawSectionTitle(doc, "一、统计摘要", width);
    const summaryLines = [
      `记录总数：${analysis.totalRecords} 条`,
      `工作当量：${formatMetric(analysis.totalWorkload)}`,
      `投入时间：${formatMetric(analysis.totalTimeHours)} 小时`,
      `数量合计：${formatMetric(analysis.totalQuantity)}`,
      `活跃天数：${analysis.activeDays} 天`,
      `参与项目：${analysis.projectCount} 个`,
      `业务分类：${analysis.businessCount} 类，工作类型：${analysis.workTypeCount} 类，产品系统：${analysis.productCount} 类`
    ];
    summaryLines.forEach((line) => {
      doc.fillColor("#4f4a43").fontSize(10).text(line, { width });
    });

    drawSectionTitle(doc, "二、重点分布", width);
    drawSummaryRows(doc, "业务分类汇总", analysis.businessSummary, width);
    drawSummaryRows(doc, "工作类型汇总", analysis.workTypeSummary, width);
    drawSummaryRows(doc, "能力维度汇总", analysis.abilitySummary, width);
    drawSummaryRows(doc, "项目汇总", analysis.projectSummary, width);
    drawSummaryRows(doc, "产品系统汇总", analysis.productSummary, width);

    drawSectionTitle(doc, "三、记录明细", width);
    if (!sortedRecords.length) {
      doc.fillColor("#786d62").fontSize(10).text("当前范围暂无记录。", { width });
    }

    sortedRecords.forEach((record, index) => {
      ensureSpace(doc, 120);
      doc.fillColor("#2b2926").fontSize(11).text(`${index + 1}. ${record.title}`, { width });
      if (record.content) {
        doc.moveDown(0.2);
        doc.fillColor("#4f4a43").fontSize(10).text(record.content, {
          width,
          indent: 14,
          lineGap: 2
        });
      }
      doc.moveDown(0.2);
      doc.fillColor("#786d62").fontSize(9).text(buildRecordMeta(record), { width, indent: 14 });
      doc.moveDown(0.55);
    });

    doc.end();
  });
}
