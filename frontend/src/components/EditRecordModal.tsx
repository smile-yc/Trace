import { FormEvent, useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { CATEGORIES } from "../constants";
import type { Category, RecordInput, WorkRecord } from "../types";

interface EditRecordModalProps {
  record: WorkRecord | null;
  onClose: () => void;
  onSave: (id: string, updates: RecordInput) => void;
}

export function EditRecordModal({ record, onClose, onSave }: EditRecordModalProps) {
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("其他");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!record) return;
    setDate(record.date);
    setTitle(record.title);
    setCategory(record.category);
    setTags(record.tags);
    setContent(record.content);
  }, [record]);

  if (!record) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!record || !title.trim()) return;
    onSave(record.id, {
      date,
      title,
      category,
      tags,
      content,
      businessCategory: record.businessCategory,
      workType: record.workType,
      projectName: record.projectName,
      productSystem: record.productSystem,
      subtask: record.subtask,
      quantity: record.quantity,
      coefficient: record.coefficient,
      workload: record.workload
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal-panel edit-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑记录</h2>
          <button type="button" className="icon-button" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="form-grid">
          <label>
            <span>标题</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            <span>日期</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label>
            <span>一级类别</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>二级标签</span>
            <input value={tags} onChange={(event) => setTags(event.target.value)} />
          </label>
        </div>

        <label className="full-field">
          <span>详细内容</span>
          <textarea value={content} onChange={(event) => setContent(event.target.value)} />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-primary">
            <Save size={16} />
            保存修改
          </button>
        </div>
      </form>
    </div>
  );
}
