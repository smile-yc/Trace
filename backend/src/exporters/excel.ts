import ExcelJS from "exceljs";
import { analyzeExport, sortRecordsForExport, type ExportSummaryItem } from "./analysis.js";
import type { AppSettings, ConfigOption, ExportPayload, KnowledgeAsset, Milestone, WorkloadStandard } from "../types.js";

type Worksheet = ExcelJS.Worksheet;

function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN");
}

function formatMetric(value: number | null | undefined): number | string {
  if (value === null || value === undefined) return "";
  return Number.isInteger(value) ? value : Number(value.toFixed(4));
}

function styleSheet(sheet: Worksheet): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF2F261B" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF3E7D5" }
  };
  header.alignment = { vertical: "middle", wrapText: true };

  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
}

function addSummaryRows(sheet: Worksheet, rows: ExportSummaryItem[]): void {
  rows.forEach((item) => {
    sheet.addRow({
      label: item.label,
      count: item.count,
      quantity: item.quantity,
      workload: item.workload,
      timeHours: item.timeHours,
      ratio: `${item.ratio}%`
    });
  });
}

function createSummarySheet(workbook: ExcelJS.Workbook, payload: ExportPayload): void {
  const analysis = analyzeExport(payload.records);
  const sheet = workbook.addWorksheet("统计摘要", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "指标", key: "metric", width: 22 },
    { header: "数值", key: "value", width: 28 },
    { header: "说明", key: "remark", width: 42 }
  ];

  const scopeLabel = payload.scope?.label || "当前记录";
  sheet.addRow({ metric: "报告标题", value: payload.title, remark: "" });
  sheet.addRow({ metric: "导出范围", value: scopeLabel, remark: payload.scope?.type || "" });
  sheet.addRow({ metric: "开始日期", value: analysis.dateStart, remark: "" });
  sheet.addRow({ metric: "结束日期", value: analysis.dateEnd, remark: "" });
  sheet.addRow({ metric: "记录总数", value: analysis.totalRecords, remark: "当前导出范围内的工作记录数" });
  sheet.addRow({ metric: "工作当量", value: analysis.totalWorkload, remark: "按记录工作当量求和" });
  sheet.addRow({ metric: "投入时间", value: analysis.totalTimeHours, remark: "按记录投入时间求和，单位小时" });
  sheet.addRow({ metric: "数量合计", value: analysis.totalQuantity, remark: "按记录数量求和" });
  sheet.addRow({ metric: "活跃天数", value: analysis.activeDays, remark: "有记录的日期数量" });
  sheet.addRow({ metric: "参与项目", value: analysis.projectCount, remark: "按项目名称或首个标签归并" });
  sheet.addRow({ metric: "业务分类数", value: analysis.businessCount, remark: "" });
  sheet.addRow({ metric: "工作类型数", value: analysis.workTypeCount, remark: "" });
  sheet.addRow({ metric: "产品系统数", value: analysis.productCount, remark: "" });

  styleSheet(sheet);
}

function createRawSheet(workbook: ExcelJS.Workbook, payload: ExportPayload): void {
  const sheet = workbook.addWorksheet("原始明细", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "日期", key: "date", width: 14 },
    { header: "标题", key: "title", width: 28 },
    { header: "内容", key: "content", width: 52 },
    { header: "一级类别", key: "category", width: 16 },
    { header: "业务分类", key: "businessCategory", width: 16 },
    { header: "工作类型", key: "workType", width: 18 },
    { header: "能力维度", key: "abilityDimension", width: 18 },
    { header: "项目名称", key: "projectName", width: 24 },
    { header: "产品系统", key: "productSystem", width: 16 },
    { header: "子任务", key: "subtask", width: 22 },
    { header: "数量", key: "quantity", width: 10 },
    { header: "折算系数", key: "coefficient", width: 12 },
    { header: "工作当量", key: "workload", width: 12 },
    { header: "投入时间", key: "timeHours", width: 12 },
    { header: "二级标签", key: "tags", width: 28 },
    { header: "创建时间", key: "createTime", width: 22 },
    { header: "更新时间", key: "updateTime", width: 22 }
  ];

  sortRecordsForExport(payload.records).forEach((record) => {
    sheet.addRow({
      date: record.date,
      title: record.title,
      content: record.content,
      category: record.category || "其他",
      businessCategory: record.businessCategory || "其他",
      workType: record.workType || "其他项",
      abilityDimension: record.abilityDimension,
      projectName: record.projectName,
      productSystem: record.productSystem,
      subtask: record.subtask,
      quantity: formatMetric(record.quantity),
      coefficient: formatMetric(record.coefficient),
      workload: formatMetric(record.workload),
      timeHours: formatMetric(record.timeHours),
      tags: record.tags,
      createTime: formatDateTime(record.createTime),
      updateTime: formatDateTime(record.updateTime)
    });
  });

  styleSheet(sheet);
}

function createDistributionSheet(workbook: ExcelJS.Workbook, name: string, rows: ExportSummaryItem[]): void {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "名称", key: "label", width: 28 },
    { header: "记录数", key: "count", width: 12 },
    { header: "数量合计", key: "quantity", width: 14 },
    { header: "当量合计", key: "workload", width: 14 },
    { header: "时间合计", key: "timeHours", width: 14 },
    { header: "占比", key: "ratio", width: 12 }
  ];

  addSummaryRows(sheet, rows);
  styleSheet(sheet);
}

function createWorkloadSheet(workbook: ExcelJS.Workbook, rows: ExportSummaryItem[]): void {
  const sheet = workbook.addWorksheet("当量统计表", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "日期", key: "label", width: 16 },
    { header: "记录数", key: "count", width: 12 },
    { header: "数量合计", key: "quantity", width: 14 },
    { header: "当量合计", key: "workload", width: 14 },
    { header: "时间合计", key: "timeHours", width: 14 },
    { header: "当量占比", key: "ratio", width: 12 }
  ];

  addSummaryRows(sheet, rows);
  styleSheet(sheet);
}

function createConfigBackupSheet(workbook: ExcelJS.Workbook, options: ConfigOption[] = []): void {
  const sheet = workbook.addWorksheet("配置项备份", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "类型", key: "type", width: 20 },
    { header: "名称", key: "label", width: 28 },
    { header: "启用", key: "enabled", width: 10 },
    { header: "排序", key: "sortOrder", width: 10 },
    { header: "默认", key: "isDefault", width: 10 },
    { header: "系统项", key: "isSystem", width: 10 },
    { header: "创建时间", key: "createTime", width: 22 },
    { header: "更新时间", key: "updateTime", width: 22 }
  ];

  options.forEach((option) => {
    sheet.addRow({
      type: option.type,
      label: option.label,
      enabled: option.enabled ? "是" : "否",
      sortOrder: option.sortOrder,
      isDefault: option.isDefault ? "是" : "否",
      isSystem: option.isSystem ? "是" : "否",
      createTime: formatDateTime(option.createTime),
      updateTime: formatDateTime(option.updateTime)
    });
  });

  styleSheet(sheet);
}

function createWorkloadStandardsSheet(workbook: ExcelJS.Workbook, standards: WorkloadStandard[] = []): void {
  const sheet = workbook.addWorksheet("当量标准备份", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "业务分类", key: "businessCategory", width: 18 },
    { header: "工作类型", key: "workType", width: 18 },
    { header: "产品系统", key: "productSystem", width: 18 },
    { header: "子任务", key: "subtask", width: 24 },
    { header: "折算系数", key: "coefficient", width: 12 },
    { header: "备注", key: "remark", width: 36 },
    { header: "启用", key: "enabled", width: 10 },
    { header: "创建时间", key: "createTime", width: 22 },
    { header: "更新时间", key: "updateTime", width: 22 }
  ];

  standards.forEach((standard) => {
    sheet.addRow({
      businessCategory: standard.businessCategory,
      workType: standard.workType,
      productSystem: standard.productSystem,
      subtask: standard.subtask,
      coefficient: standard.coefficient,
      remark: standard.remark,
      enabled: standard.enabled ? "是" : "否",
      createTime: formatDateTime(standard.createTime),
      updateTime: formatDateTime(standard.updateTime)
    });
  });

  styleSheet(sheet);
}

function createAppSettingsSheet(workbook: ExcelJS.Workbook, settings?: AppSettings): void {
  const sheet = workbook.addWorksheet("分析规则备份", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "规则", key: "rule", width: 28 },
    { header: "数值", key: "value", width: 18 },
    { header: "说明", key: "remark", width: 42 }
  ];

  if (settings) {
    sheet.addRow({ rule: "工作当量权重", value: settings.focusScoreWeights.workload, remark: "工作重心评分使用" });
    sheet.addRow({ rule: "投入时间权重", value: settings.focusScoreWeights.timeHours, remark: "工作重心评分使用" });
    sheet.addRow({ rule: "记录数量权重", value: settings.focusScoreWeights.recordCount, remark: "工作重心评分使用" });
    sheet.addRow({ rule: "能力未记录天数", value: settings.warningRules.abilityNoRecordDays, remark: "查漏补缺预警阈值" });
    sheet.addRow({ rule: "目标占比偏差%", value: settings.warningRules.targetShareDeviationPercent, remark: "查漏补缺预警阈值" });
    Object.entries(settings.abilityTargets).forEach(([label, target]) => {
      sheet.addRow({ rule: `能力目标：${label}`, value: target, remark: "能力目标占比%" });
    });
  }

  styleSheet(sheet);
}

function createMilestonesSheet(workbook: ExcelJS.Workbook, milestones: Milestone[] = []): void {
  const sheet = workbook.addWorksheet("成长里程碑", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "名称", key: "name", width: 28 },
    { header: "分类", key: "category", width: 16 },
    { header: "目标类型", key: "targetType", width: 16 },
    { header: "目标值", key: "targetValue", width: 12 },
    { header: "当前值", key: "currentValue", width: 12 },
    { header: "进度", key: "progress", width: 12 },
    { header: "截止日期", key: "deadline", width: 14 },
    { header: "启用", key: "enabled", width: 10 },
    { header: "说明", key: "description", width: 42 },
    { header: "更新时间", key: "updateTime", width: 22 }
  ];

  milestones.forEach((milestone) => {
    const progress = milestone.targetValue > 0 ? Math.min(100, (milestone.currentValue / milestone.targetValue) * 100) : 0;
    sheet.addRow({
      name: milestone.name,
      category: milestone.category,
      targetType: milestone.targetType,
      targetValue: milestone.targetValue,
      currentValue: milestone.currentValue,
      progress: `${Number(progress.toFixed(1))}%`,
      deadline: milestone.deadline,
      enabled: milestone.enabled ? "是" : "否",
      description: milestone.description,
      updateTime: formatDateTime(milestone.updateTime)
    });
  });

  styleSheet(sheet);
}

function createKnowledgeAssetsSheet(workbook: ExcelJS.Workbook, assets: KnowledgeAsset[] = []): void {
  const sheet = workbook.addWorksheet("知识资产库", {
    views: [{ state: "frozen", ySplit: 1 }]
  });

  sheet.columns = [
    { header: "类型", key: "type", width: 16 },
    { header: "标题", key: "title", width: 30 },
    { header: "状态", key: "status", width: 12 },
    { header: "项目", key: "projectName", width: 24 },
    { header: "产品系统", key: "productSystem", width: 16 },
    { header: "标签", key: "tags", width: 24 },
    { header: "链接", key: "link", width: 34 },
    { header: "摘要", key: "summary", width: 48 },
    { header: "备注", key: "remark", width: 32 },
    { header: "更新时间", key: "updateTime", width: 22 }
  ];

  assets.forEach((asset) => {
    sheet.addRow({
      type: asset.type,
      title: asset.title,
      status: asset.status,
      projectName: asset.projectName,
      productSystem: asset.productSystem,
      tags: asset.tags,
      link: asset.link,
      summary: asset.summary,
      remark: asset.remark,
      updateTime: formatDateTime(asset.updateTime)
    });
  });

  styleSheet(sheet);
}

export async function buildExcel(payload: ExportPayload): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const analysis = analyzeExport(payload.records);

  workbook.creator = "Trace Work Report";
  workbook.created = new Date();

  createSummarySheet(workbook, payload);
  createRawSheet(workbook, payload);
  createDistributionSheet(workbook, "业务分类汇总", analysis.businessSummary);
  createDistributionSheet(workbook, "工作类型汇总", analysis.workTypeSummary);
  createDistributionSheet(workbook, "能力维度汇总", analysis.abilitySummary);
  createDistributionSheet(workbook, "项目汇总", analysis.projectSummary);
  createDistributionSheet(workbook, "产品系统汇总", analysis.productSummary);
  createWorkloadSheet(workbook, analysis.dateSummary);
  createConfigBackupSheet(workbook, payload.configOptions);
  createWorkloadStandardsSheet(workbook, payload.workloadStandards);
  createAppSettingsSheet(workbook, payload.appSettings);
  createMilestonesSheet(workbook, payload.milestones);
  createKnowledgeAssetsSheet(workbook, payload.knowledgeAssets);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
