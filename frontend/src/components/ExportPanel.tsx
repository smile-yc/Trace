import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { exportOffice } from "../lib/exportApi";
import { splitTags } from "../lib/records";
import type { ExportFormat, ExportScope, WorkRecord } from "../types";

interface ExportPanelProps {
  records: WorkRecord[];
  title: string;
  periodType: "week" | "month" | "year";
  startDate: string;
  endDate: string;
  onNotify: (message: string) => void;
  workloadAdjustmentPercent?: number;
}

type ExportKind = "period" | "project" | "businessCategory";

function getProjectName(record: WorkRecord): string {
  return record.projectName || splitTags(record.tags)[0] || "未归属项目";
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function formatName(format: ExportFormat): string {
  if (format === "docx") return "Word";
  if (format === "pdf") return "PDF";
  return "Excel";
}

function formatIcon(format: ExportFormat) {
  if (format === "xlsx") return <FileSpreadsheet size={15} />;
  if (format === "docx") return <FileText size={15} />;
  return <Download size={15} />;
}

export function ExportPanel({ records, title, periodType, startDate, endDate, onNotify, workloadAdjustmentPercent = 100 }: ExportPanelProps) {
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const projectOptions = useMemo(() => uniqueValues(records.map(getProjectName)), [records]);
  const businessOptions = useMemo(
    () => uniqueValues(records.map((record) => record.businessCategory || record.category || "其他")),
    [records]
  );

  useEffect(() => {
    setSelectedProject((current) => (current && projectOptions.includes(current) ? current : projectOptions[0] ?? ""));
  }, [projectOptions]);

  useEffect(() => {
    setSelectedBusiness((current) => (current && businessOptions.includes(current) ? current : businessOptions[0] ?? ""));
  }, [businessOptions]);

  async function handleExport(format: ExportFormat, kind: ExportKind): Promise<void> {
    let targetRecords = records;
    let exportTitle = title;
    let scope: ExportScope = {
      type: "period",
      periodType,
      label: title,
      startDate,
      endDate
    };

    if (kind === "project") {
      if (!selectedProject) {
        onNotify("当前范围没有可导出的项目");
        return;
      }
      targetRecords = records.filter((record) => getProjectName(record) === selectedProject);
      exportTitle = `${title}_${selectedProject}`;
      scope = {
        type: "project",
        periodType,
        label: `${title} / ${selectedProject}`,
        startDate,
        endDate,
        filterValue: selectedProject
      };
    }

    if (kind === "businessCategory") {
      if (!selectedBusiness) {
        onNotify("当前范围没有可导出的业务分类");
        return;
      }
      targetRecords = records.filter((record) => (record.businessCategory || record.category || "其他") === selectedBusiness);
      exportTitle = `${title}_${selectedBusiness}`;
      scope = {
        type: "businessCategory",
        periodType,
        label: `${title} / ${selectedBusiness}`,
        startDate,
        endDate,
        filterValue: selectedBusiness
      };
    }

    if (!targetRecords.length) {
      onNotify("当前范围没有记录可导出");
      return;
    }

    const exportingKey = `${kind}-${format}`;
    try {
      setExporting(exportingKey);
      await exportOffice(format, exportTitle, targetRecords, { scope, workloadAdjustmentPercent });
      onNotify(`${formatName(format)} 导出完成`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "导出失败");
    } finally {
      setExporting(null);
    }
  }

  function renderButtons(kind: ExportKind) {
    return (
      <div className="export-format-buttons">
        {(["docx", "pdf", "xlsx"] as ExportFormat[]).map((format) => {
          const key = `${kind}-${format}`;
          return (
            <button
              className={format === "xlsx" ? "primary-button" : "ghost-button"}
              disabled={Boolean(exporting) || !records.length}
              key={format}
              onClick={() => void handleExport(format, kind)}
              type="button"
            >
              {formatIcon(format)}
              {exporting === key ? "导出中" : formatName(format)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <section className="panel export-panel no-print">
      <div className="panel-heading">
        <h2>汇报导出</h2>
        <span>{records.length} 条</span>
      </div>

      <div className="export-scope-grid">
        <article className="export-scope-card">
          <div>
            <strong>当前周期</strong>
            <span>{startDate} - {endDate}</span>
            {periodType === "year" && <span>本次汇报折算：{workloadAdjustmentPercent}%（原始明细不变）</span>}
          </div>
          {renderButtons("period")}
        </article>

        <article className="export-scope-card">
          <label>
            <span>按项目</span>
            <select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)}>
              {projectOptions.map((project) => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </label>
          {renderButtons("project")}
        </article>

        <article className="export-scope-card">
          <label>
            <span>按业务分类</span>
            <select value={selectedBusiness} onChange={(event) => setSelectedBusiness(event.target.value)}>
              {businessOptions.map((business) => (
                <option key={business} value={business}>{business}</option>
              ))}
            </select>
          </label>
          {renderButtons("businessCategory")}
        </article>
      </div>
    </section>
  );
}
