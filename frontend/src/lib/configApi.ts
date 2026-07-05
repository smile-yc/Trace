import { API_BASE } from "../constants";
import type { ConfigOption, ConfigOptionInput, ConfigOptionType, ConfigOptionUpdateInput } from "../types";

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

export async function fetchConfigOptions(type?: ConfigOptionType): Promise<ConfigOption[]> {
  const query = type ? `?type=${encodeURIComponent(type)}` : "";
  const response = await fetch(`${API_BASE}/api/config-options${query}`);
  const data = await readJson<{ options: ConfigOption[] }>(response);
  return data.options;
}

export async function createConfigOption(input: ConfigOptionInput): Promise<ConfigOption> {
  const response = await fetch(`${API_BASE}/api/config-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ option: ConfigOption }>(response);
  return data.option;
}

export async function updateConfigOptionApi(
  id: string,
  input: ConfigOptionUpdateInput
): Promise<ConfigOption> {
  const response = await fetch(`${API_BASE}/api/config-options/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ option: ConfigOption }>(response);
  return data.option;
}

export async function reorderConfigOptionsApi(
  type: ConfigOptionType,
  orderedIds: string[]
): Promise<ConfigOption[]> {
  const response = await fetch(`${API_BASE}/api/config-options/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, orderedIds })
  });
  const data = await readJson<{ options: ConfigOption[] }>(response);
  return data.options;
}
