import { X } from "lucide-react";
import type { RecordInput, WorkRecord } from "../types";
import { RecordForm } from "./RecordForm";

interface EditModalProps {
  record: WorkRecord | null;
  onClose: () => void;
  onSave: (id: string, input: RecordInput) => void | Promise<void>;
}

export function EditModal({ record, onClose, onSave }: EditModalProps) {
  if (!record) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-label="编辑记录"
        className="modal edit-modal"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span>记录编辑</span>
            <h2>编辑工作记录</h2>
          </div>
          <button aria-label="关闭弹窗" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <RecordForm
          record={record}
          onSubmit={async (input) => {
            await onSave(record.id, input);
            onClose();
          }}
        />
      </section>
    </div>
  );
}
