import { useState } from "react";
import { EditModal } from "./components/EditModal";
import { ReportModal } from "./components/ReportModal";
import { Sidebar } from "./components/Sidebar";
import { AllRecordsPage } from "./pages/AllRecordsPage";
import { DailyPage } from "./pages/DailyPage";
import { GrowthPage } from "./pages/GrowthPage";
import { KnowledgePage } from "./pages/KnowledgePage";
import { MonthlyPage } from "./pages/MonthlyPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WeeklyPage } from "./pages/WeeklyPage";
import { YearlyPage } from "./pages/YearlyPage";
import { exportOffice } from "./lib/exportApi";
import { generateTagReport } from "./lib/report";
import { useRecords } from "./lib/useRecords";
import type { ExportFormat, RecordInput, ReportBundle, ViewMode, WorkRecord } from "./types";

export function App() {
  const { records, loading, error, addRecord, updateRecord, deleteRecord, clearRecords } = useRecords();
  const [activeView, setActiveView] = useState<ViewMode>("daily");
  const [editingRecord, setEditingRecord] = useState<WorkRecord | null>(null);
  const [report, setReport] = useState<ReportBundle | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string): void {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  async function handleAdd(input: RecordInput): Promise<void> {
    try {
      await addRecord(input);
      showToast("记录已保存到服务器数据库");
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "保存失败");
    }
  }

  async function handleSaveEdit(id: string, input: RecordInput): Promise<void> {
    try {
      await updateRecord(id, input);
      showToast("记录已更新");
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "更新失败");
    }
  }

  async function handleDelete(record: WorkRecord): Promise<void> {
    if (!window.confirm(`确认删除「${record.title}」吗？`)) return;

    try {
      await deleteRecord(record.id);
      showToast("记录已删除");
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "删除失败");
    }
  }

  async function handleClear(): Promise<void> {
    try {
      await clearRecords();
      showToast("数据已清空");
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "清空失败");
    }
  }

  function handleGenerateReport(targetRecords: WorkRecord[], title: string): void {
    if (!targetRecords.length) {
      showToast("当前范围没有记录可生成报告");
      return;
    }

    setReport(generateTagReport(targetRecords, title));
  }

  async function handleCopyReport(): Promise<void> {
    if (!report) return;

    try {
      await navigator.clipboard.writeText(report.content);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = report.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }

    showToast("报告已复制");
  }

  async function handleOfficeExport(format: ExportFormat): Promise<void> {
    if (!report || exporting) return;

    try {
      setExporting(format);
      await exportOffice(format, report.title, report.records, {
        scope: {
          type: "custom",
          label: report.title
        }
      });
      showToast("导出完成");
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : "导出失败");
    } finally {
      setExporting(null);
    }
  }

  function renderPage() {
    if (activeView === "weekly") {
      return <WeeklyPage records={records} onGenerateReport={handleGenerateReport} onNotify={showToast} />;
    }

    if (activeView === "monthly") {
      return <MonthlyPage records={records} onGenerateReport={handleGenerateReport} onNotify={showToast} />;
    }

    if (activeView === "yearly") {
      return <YearlyPage records={records} onGenerateReport={handleGenerateReport} onNotify={showToast} />;
    }

    if (activeView === "growth") {
      return <GrowthPage records={records} onNotify={showToast} />;
    }

    if (activeView === "knowledge") {
      return <KnowledgePage records={records} onNotify={showToast} />;
    }

    if (activeView === "all") {
      return (
        <AllRecordsPage
          records={records}
          onEdit={setEditingRecord}
          onDelete={handleDelete}
          onClear={handleClear}
          onGenerateReport={handleGenerateReport}
        />
      );
    }

    if (activeView === "settings") {
      return <SettingsPage onNotify={showToast} />;
    }

    return <DailyPage records={records} onAdd={handleAdd} onEdit={setEditingRecord} onDelete={handleDelete} />;
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} records={records} onViewChange={setActiveView} />
      <main className="workspace">
        {loading && <div className="status-banner">正在从服务器数据库读取记录...</div>}
        {error && <div className="status-banner error">数据加载失败：{error}</div>}
        {renderPage()}
      </main>

      <EditModal record={editingRecord} onClose={() => setEditingRecord(null)} onSave={handleSaveEdit} />
      <ReportModal
        report={report}
        exporting={exporting}
        onClose={() => setReport(null)}
        onCopy={handleCopyReport}
        onExport={handleOfficeExport}
      />

      {toast && <div className="toast no-print">{toast}</div>}
    </div>
  );
}
