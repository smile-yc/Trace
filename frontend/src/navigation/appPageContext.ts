import type { OutcomeSeed, RecordInput, WorkRecord } from "../types";

export interface AppPageContext {
  activePageId: string;
  records: WorkRecord[];
  onAddRecord: (input: RecordInput) => Promise<void>;
  onEditRecord: (record: WorkRecord) => void;
  onDeleteRecord: (record: WorkRecord) => Promise<void>;
  onClearRecords: () => Promise<void>;
  onGenerateReport: (records: WorkRecord[], title: string) => void;
  onCreateOutcome: (seed: Omit<OutcomeSeed, "nonce">) => void;
  outcomeSeed: OutcomeSeed | null;
  onOutcomeSeedConsumed: () => void;
  onNotify: (message: string) => void;
}
