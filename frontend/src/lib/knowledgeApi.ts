import { API_BASE } from "../constants";
import type { KnowledgeAsset, KnowledgeAssetInput, KnowledgeAssetUpdateInput } from "../types";

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

export async function fetchKnowledgeAssets(): Promise<KnowledgeAsset[]> {
  const response = await fetch(`${API_BASE}/api/knowledge-assets`);
  const data = await readJson<{ assets: KnowledgeAsset[] }>(response);
  return data.assets;
}

export async function createKnowledgeAsset(input: KnowledgeAssetInput): Promise<KnowledgeAsset> {
  const response = await fetch(`${API_BASE}/api/knowledge-assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ asset: KnowledgeAsset }>(response);
  return data.asset;
}

export async function updateKnowledgeAssetApi(
  id: string,
  input: KnowledgeAssetUpdateInput
): Promise<KnowledgeAsset> {
  const response = await fetch(`${API_BASE}/api/knowledge-assets/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const data = await readJson<{ asset: KnowledgeAsset }>(response);
  return data.asset;
}
