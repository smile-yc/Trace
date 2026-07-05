import { Clipboard, Download, FileSpreadsheet, FileText, X } from "lucide-react";
import type { ExportFormat, ReportBundle } from "../types";

interface ReportModalProps {
  report: ReportBundle | null;
  exporting: ExportFormat | null;
  onClose: () => void;
  onCopy: () => void;
  onExport: (format: ExportFormat) => void;
}

export function ReportModal({ report, exporting, onClose, onCopy, onExport }: ReportModalProps) {
  if (!report) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="报告预览"
        className="modal report-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span>报告预览</span>
            <h2>{report.title}</h2>
          </div>
          <button aria-label="关闭弹窗" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>

        <pre className="report-preview">{report.content}</pre>

        <footer className="modal-actions no-print">
          <button className="ghost-button" onClick={onCopy} type="button">
            <Clipboard size={16} />
            复制报告
          </button>
          <button className="primary-button" disabled={Boolean(exporting)} onClick={() => onExport("docx")} type="button">
            <FileText size={16} />
            {exporting === "docx" ? "导出中" : "导出 Word"}
          </button>
          <button className="primary-button" disabled={Boolean(exporting)} onClick={() => onExport("pdf")} type="button">
            <Download size={16} />
            {exporting === "pdf" ? "导出中" : "导出 PDF"}
          </button>
          <button className="primary-button" disabled={Boolean(exporting)} onClick={() => onExport("xlsx")} type="button">
            <FileSpreadsheet size={16} />
            {exporting === "xlsx" ? "导出中" : "导出 Excel"}
          </button>
        </footer>
      </section>
    </div>
  );
}
