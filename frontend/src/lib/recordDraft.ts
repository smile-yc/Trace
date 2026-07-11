export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RecordDraft {
  version: 1;
  date: string;
  title: string;
  businessCategory: string;
  workType: string;
  abilityDimension: string;
  projectName: string;
  productSystem: string;
  subtask: string;
  quantity: string;
  coefficient: string;
  workload: string;
  timeHours: string;
  tags: string;
  content: string;
}

const RECORD_DRAFT_KEY = "trace:daily-record-draft";
const STRING_FIELDS: Array<keyof Omit<RecordDraft, "version">> = [
  "date", "title", "businessCategory", "workType", "abilityDimension", "projectName", "productSystem",
  "subtask", "quantity", "coefficient", "workload", "timeHours", "tags", "content"
];

function isRecordDraft(value: unknown): value is RecordDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1 && STRING_FIELDS.every((field) => typeof candidate[field] === "string");
}

export function loadRecordDraft(storage: StorageLike): RecordDraft | null {
  try {
    const stored = storage.getItem(RECORD_DRAFT_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    return isRecordDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRecordDraft(storage: StorageLike, draft: RecordDraft): void {
  storage.setItem(RECORD_DRAFT_KEY, JSON.stringify(draft));
}

export function clearRecordDraft(storage: StorageLike): void {
  storage.removeItem(RECORD_DRAFT_KEY);
}
