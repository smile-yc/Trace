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

function summaryLine(item: ExportSummaryItem): string {
  return `${item.label}：${item.count} 条，${formatMetric(item.workload)} 当量，${formatMetric(item.timeHours)} 小时，占比 ${item.ratio}%`;
}

export async function buildWord(payload: ExportPayload): Promise<Buffer> {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } = (await import("docx")) as Record<string, any>;
  const analysis = analyzeExport(payload.records);
  const sortedRecords = sortRecordsForExport(payload.records);
  const scopeText = payload.scope?.label ? `导出范围：${payload.scope.label}` : "导出范围：当前记录";
  const dateText = analysis.dateStart
    ? `统计周期：${formatDate(analysis.dateStart)} 至 ${formatDate(analysis.dateEnd)}`
    : "统计周期：暂无记录";

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: payload.title, bold: true, size: 34 })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: `${scopeText}    ${dateText}`, size: 20, color: "666666" })]
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 180, after: 100 },
      children: [new TextRun({ text: "一、统计摘要", bold: true })]
    }),
    new Paragraph({ children: [new TextRun(`记录总数：${analysis.totalRecords} 条`)] }),
    new Paragraph({ children: [new TextRun(`工作当量：${formatMetric(analysis.totalWorkload)}`)] }),
    new Paragraph({ children: [new TextRun(`投入时间：${formatMetric(analysis.totalTimeHours)} 小时`)] }),
    new Paragraph({ children: [new TextRun(`数量合计：${formatMetric(analysis.totalQuantity)}`)] }),
    new Paragraph({ children: [new TextRun(`活跃天数：${analysis.activeDays} 天`)] }),
    new Paragraph({ children: [new TextRun(`参与项目：${analysis.projectCount} 个`)] }),
    new Paragraph({ children: [new TextRun(`业务分类：${analysis.businessCount} 类，工作类型：${analysis.workTypeCount} 类，产品系统：${analysis.productCount} 类`)] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 260, after: 100 },
      children: [new TextRun({ text: "二、重点分布", bold: true })]
    })
  ];

  const sections: Array<[string, ExportSummaryItem[]]> = [
    ["业务分类汇总", analysis.businessSummary],
    ["工作类型汇总", analysis.workTypeSummary],
    ["能力维度汇总", analysis.abilitySummary],
    ["项目汇总", analysis.projectSummary],
    ["产品系统汇总", analysis.productSummary]
  ];

  sections.forEach(([title, rows]) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: title, bold: true })]
      })
    );

    if (!rows.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: "暂无数据", color: "777777" })] }));
      return;
    }

    rows.slice(0, 8).forEach((item, index) => {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun(`${index + 1}. ${summaryLine(item)}`)]
        })
      );
    });
  });

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: "三、记录明细", bold: true })]
    })
  );

  if (!sortedRecords.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: "当前范围暂无记录。", color: "777777" })] }));
  }

  sortedRecords.forEach((record, index) => {
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text: `${index + 1}. ${record.title}`, bold: true, size: 22 })]
      })
    );

    if (record.content) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: record.content, size: 20 })]
        })
      );
    }

    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: buildRecordMeta(record), size: 18, color: "777777" })]
      })
    );
  });

  const document = new Document({
    creator: "Trace Work Report",
    title: payload.title,
    description: "包含统计摘要和明细的工作报告",
    sections: [{ children }]
  });

  return Packer.toBuffer(document);
}
