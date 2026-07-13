import type { RecordInput, WorkRecord } from "../types";

export interface AppPageContext {
  records: WorkRecord[];
  onAddRecord: (input: RecordInput) => Promise<void>;
  onEditRecord: (record: WorkRecord) => void;
  onDeleteRecord: (record: WorkRecord) => Promise<void>;
  onClearRecords: () => Promise<void>;
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onNotify: (message: string) => void;
}
