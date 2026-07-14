export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RecordDraft {
  version: 2;
  date: string;
  title: string;
  businessCategory: string;
  workType: string;
  abilityDimension: string;
  projectName: string;
  projectId: string;
  projectRelation: "project" | "non_project" | "unassigned";
  productSystem: string;
  subtask: string;
  quantity: string;
  coefficient: string;
  workload: string;
  timeHours: string;
  tags: string;
  content: string;
}

interface RecordDraftV1 extends Omit<RecordDraft, "version" | "projectId" | "projectRelation"> {
  version: 1;
}

const RECORD_DRAFT_KEY = "trace:daily-record-draft";
const STRING_FIELDS: Array<keyof Omit<RecordDraft, "version" | "projectRelation">> = [
  "date", "title", "businessCategory", "workType", "abilityDimension", "projectName", "projectId", "productSystem",
  "subtask", "quantity", "coefficient", "workload", "timeHours", "tags", "content"
];

const V1_STRING_FIELDS = STRING_FIELDS.filter((field) => field !== "projectId");

function isRecordDraft(value: unknown): value is RecordDraft {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 2
    && ["project", "non_project", "unassigned"].includes(String(candidate.projectRelation))
    && STRING_FIELDS.every((field) => typeof candidate[field] === "string");
}

function isRecordDraftV1(value: unknown): value is RecordDraftV1 {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1 && V1_STRING_FIELDS.every((field) => typeof candidate[field] === "string");
}

export function loadRecordDraft(storage: StorageLike): RecordDraft | null {
  try {
    const stored = storage.getItem(RECORD_DRAFT_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (isRecordDraft(parsed)) return parsed;
    if (isRecordDraftV1(parsed)) {
      return { ...parsed, version: 2, projectId: "", projectRelation: "unassigned" };
    }
    return null;
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
