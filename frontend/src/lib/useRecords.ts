import { useCallback, useEffect, useState } from "react";
import type { RecordInput, WorkRecord } from "../types";
import {
  clearRecordsApi,
  createRecordApi,
  deleteRecordApi,
  fetchRecords,
  updateRecordApi
} from "./recordsApi";
import { sortRecordsDesc } from "./records";

export function useRecords() {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const nextRecords = await fetchRecords();
      setRecords(sortRecordsDesc(nextRecords));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addRecord = useCallback(async (input: RecordInput) => {
    const record = await createRecordApi(input);
    setRecords((current) => sortRecordsDesc([record, ...current]));
  }, []);

  const updateRecord = useCallback(async (id: string, input: RecordInput) => {
    const record = await updateRecordApi(id, input);
    setRecords((current) => sortRecordsDesc(current.map((item) => (item.id === id ? record : item))));
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    await deleteRecordApi(id);
    setRecords((current) => current.filter((record) => record.id !== id));
  }, []);

  const clearRecords = useCallback(async () => {
    await clearRecordsApi();
    setRecords([]);
  }, []);

  return {
    records,
    loading,
    error,
    reload,
    addRecord,
    updateRecord,
    deleteRecord,
    clearRecords
  };
}
