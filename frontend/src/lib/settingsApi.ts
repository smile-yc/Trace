import { API_BASE } from "../constants";
import type { AppSettings, AppSettingsInput } from "../types";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  focusScoreWeights: {
    workload: 50,
    timeHours: 30,
    recordCount: 20
  },
  warningRules: {
    abilityNoRecordDays: 30,
    targetShareDeviationPercent: 10
  },
  abilityTargets: {}
};

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "请求失败";
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      message = await response.text();
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchSettings(): Promise<AppSettings> {
  const response = await fetch(`${API_BASE}/api/settings`);
  const data = await readJson<{ settings: AppSettings }>(response);
  return data.settings;
}

export async function updateSettings(input: AppSettingsInput): Promise<AppSettings> {
  const response = await fetch(`${API_BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ settings: AppSettings }>(response);
  return data.settings;
}
