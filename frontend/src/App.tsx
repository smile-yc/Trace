import { useLayoutEffect, useRef, useState } from "react";
import { EditModal } from "./components/EditModal";
import { ReportModal } from "./components/ReportModal";
import { AppShell } from "./components/layout";
import { exportOffice } from "./lib/exportApi";
import { generateTagReport } from "./lib/report";
import { useRecords } from "./lib/useRecords";
import {
  CORE_PAGE_PACKAGES,
  createPageNavigationState,
  createPageRegistry,
  getNavigationLabel,
  getPageScrollTop,
  navigateToPage,
  TRACE_NAVIGATION,
  type AppPageContext
} from "./navigation";
import type { ExportFormat, RecordInput, ReportBundle, WorkRecord } from "./types";

export function App() {
  const { records, loading, error, addRecord, updateRecord, deleteRecord, clearRecords } = useRecords();
  const [pageNavigation, setPageNavigation] = useState(() => createPageNavigationState("daily"));
  const [editingRecord, setEditingRecord] = useState<WorkRecord | null>(null);
  const [report, setReport] = useState<ReportBundle | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  function showToast(message: string): void {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToast(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2400);
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

  const pageRegistry = createPageRegistry<AppPageContext>({
    defaultPageId: "daily",
    packages: CORE_PAGE_PACKAGES
  });
  const activePage = pageRegistry.getPage(pageNavigation.activePageId) ?? pageRegistry.getDefaultPage();
  const pageContext: AppPageContext = {
    records,
    onAddRecord: handleAdd,
    onEditRecord: setEditingRecord,
    onDeleteRecord: handleDelete,
    onClearRecords: handleClear,
    onGenerateReport: handleGenerateReport,
    onNotify: showToast
  };

  function handleNavigate(pageId: string) {
    setPageNavigation((current) => navigateToPage(current, pageId, window.scrollY));
  }

  useLayoutEffect(() => {
    const scrollTop = getPageScrollTop(pageNavigation, pageNavigation.activePageId);
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" }));
    return () => window.cancelAnimationFrame(frame);
  }, [pageNavigation.activePageId]);

  return (
    <AppShell
      activePageId={activePage.id}
      activePageLabel={getNavigationLabel(activePage.id)}
      navigation={TRACE_NAVIGATION}
      onNavigate={handleNavigate}
      footer={<><span>记录</span><strong>{records.length}</strong></>}
    >
        {loading && <div className="status-banner">正在从服务器数据库读取记录...</div>}
        {error && <div className="status-banner error">数据加载失败：{error}</div>}
        <div className="app-page-stack">
          {pageRegistry.pages
            .filter((page) => pageNavigation.visitedPageIds.includes(page.id))
            .map((page) => {
              const isActive = page.id === activePage.id;
              const domainClass = page.group === "system"
                ? "trace-settings-data"
                : page.group === "growth" || page.group === "review"
                  ? "trace-growth-reports"
                  : "trace-work-outcomes";

              return (
                <section
                  className={`app-page ${domainClass}`}
                  data-page-id={page.id}
                  hidden={!isActive}
                  aria-hidden={!isActive}
                  key={page.id}
                >
                  {page.render(pageContext)}
                </section>
              );
            })}
        </div>

      <EditModal record={editingRecord} onClose={() => setEditingRecord(null)} onSave={handleSaveEdit} />
      <ReportModal
        report={report}
        exporting={exporting}
        onClose={() => setReport(null)}
        onCopy={handleCopyReport}
        onExport={handleOfficeExport}
      />

      {toast && <div className="toast no-print">{toast}</div>}
    </AppShell>
  );
}
