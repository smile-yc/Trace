import { Archive, BookOpen, Link as LinkIcon, Plus, RefreshCw, Save } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { createKnowledgeAsset, fetchKnowledgeAssets, updateKnowledgeAssetApi } from "../lib/knowledgeApi";
import { summarizeKnowledgeAssets } from "../lib/growthReview";
import type { KnowledgeAsset, KnowledgeAssetStatus, WorkRecord } from "../types";

interface KnowledgePageProps {
  records: WorkRecord[];
  onNotify: (message: string) => void;
}

interface KnowledgeDraft {
  type: string;
  title: string;
  summary: string;
  sourceRecordId: string;
  projectName: string;
  productSystem: string;
  tags: string;
  status: KnowledgeAssetStatus;
  link: string;
  remark: string;
}

const emptyDraft: KnowledgeDraft = {
  type: "复盘",
  title: "",
  summary: "",
  sourceRecordId: "",
  projectName: "",
  productSystem: "",
  tags: "",
  status: "draft",
  link: "",
  remark: ""
};

const statusLabels: Record<KnowledgeAssetStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档"
};

function newestRecords(records: WorkRecord[]): WorkRecord[] {
  return records.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createTime - a.createTime).slice(0, 40);
}

export function KnowledgePage({ records, onNotify }: KnowledgePageProps) {
  const [assets, setAssets] = useState<KnowledgeAsset[]>([]);
  const [draft, setDraft] = useState<KnowledgeDraft>(emptyDraft);
  const [assetDrafts, setAssetDrafts] = useState<Record<string, Pick<KnowledgeAsset, "status" | "remark">>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadAssets(): Promise<void> {
    try {
      setLoading(true);
      const nextAssets = await fetchKnowledgeAssets();
      setAssets(nextAssets);
      setAssetDrafts(
        nextAssets.reduce<Record<string, Pick<KnowledgeAsset, "status" | "remark">>>((drafts, asset) => {
          drafts[asset.id] = { status: asset.status, remark: asset.remark };
          return drafts;
        }, {})
      );
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "知识资产读取失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAssets();
  }, []);

  const assetSummary = useMemo(() => summarizeKnowledgeAssets(assets), [assets]);
  const recordOptions = useMemo(() => newestRecords(records), [records]);

  function selectSourceRecord(recordId: string): void {
    const record = records.find((item) => item.id === recordId);
    setDraft((current) => ({
      ...current,
      sourceRecordId: recordId,
      projectName: record?.projectName || current.projectName,
      productSystem: record?.productSystem || current.productSystem,
      tags: record?.tags || current.tags
    }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft.title.trim()) return;

    try {
      const asset = await createKnowledgeAsset(draft);
      setAssets((current) => [asset, ...current]);
      setAssetDrafts((current) => ({ ...current, [asset.id]: { status: asset.status, remark: asset.remark } }));
      setDraft(emptyDraft);
      onNotify("知识资产已新增");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "新增知识资产失败");
    }
  }

  async function handleSave(asset: KnowledgeAsset): Promise<void> {
    const nextDraft = assetDrafts[asset.id];
    if (!nextDraft) return;

    try {
      setSavingId(asset.id);
      const nextAsset = await updateKnowledgeAssetApi(asset.id, nextDraft);
      setAssets((current) => current.map((item) => (item.id === asset.id ? nextAsset : item)));
      setAssetDrafts((current) => ({ ...current, [asset.id]: { status: nextAsset.status, remark: nextAsset.remark } }));
      onNotify("知识资产已更新");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "保存知识资产失败");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Knowledge"
        title="知识资产库"
        description="沉淀可复用的方案、复盘、模板和交付物。"
        actions={
          <button className="ghost-button" disabled={loading} onClick={loadAssets} type="button">
            <RefreshCw size={16} />
            刷新
          </button>
        }
      />

      <StatCards
        items={[
          { label: "资产总数", value: assetSummary.total },
          { label: "已发布", value: assetSummary.byStatus.published },
          { label: "草稿", value: assetSummary.byStatus.draft },
          { label: "已归档", value: assetSummary.byStatus.archived }
        ]}
      />

      <section className="panel knowledge-form-panel">
        <div className="panel-heading">
          <h2>新增知识资产</h2>
          <BookOpen size={18} />
        </div>
        <form className="knowledge-form" onSubmit={handleCreate}>
          <label>
            <span>资产类型</span>
            <input value={draft.type} onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))} />
          </label>
          <label className="wide">
            <span>标题</span>
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </label>
          <label>
            <span>状态</span>
            <select
              value={draft.status}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as KnowledgeAssetStatus }))}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>关联日报</span>
            <select value={draft.sourceRecordId} onChange={(event) => selectSourceRecord(event.target.value)}>
              <option value="">不关联</option>
              {recordOptions.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.date} {record.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>项目</span>
            <input
              value={draft.projectName}
              onChange={(event) => setDraft((current) => ({ ...current, projectName: event.target.value }))}
            />
          </label>
          <label>
            <span>产品系统</span>
            <input
              value={draft.productSystem}
              onChange={(event) => setDraft((current) => ({ ...current, productSystem: event.target.value }))}
            />
          </label>
          <label>
            <span>标签</span>
            <input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} />
          </label>
          <label className="wide">
            <span>链接</span>
            <input value={draft.link} onChange={(event) => setDraft((current) => ({ ...current, link: event.target.value }))} />
          </label>
          <label className="wide">
            <span>摘要</span>
            <textarea
              value={draft.summary}
              onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
            />
          </label>
          <button className="primary-button" type="submit">
            <Plus size={16} />
            新增资产
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>资产列表</h2>
          <span>{assets.length} 项</span>
        </div>
        <div className="knowledge-list">
          {assets.length ? (
            assets.map((asset) => {
              const draftValue = assetDrafts[asset.id] ?? { status: asset.status, remark: asset.remark };
              const isBusy = savingId === asset.id;

              return (
                <article className="knowledge-card" key={asset.id}>
                  <div className="knowledge-card-top">
                    <div>
                      <strong>{asset.title}</strong>
                      <span>
                        {asset.type || "未分类"} / {statusLabels[asset.status]}
                        {asset.projectName ? ` / ${asset.projectName}` : ""}
                      </span>
                    </div>
                    {asset.status === "archived" && <Archive size={18} />}
                  </div>
                  {asset.summary && <p>{asset.summary}</p>}
                  <div className="record-meta">
                    {asset.productSystem && <span className="detail-chip">{asset.productSystem}</span>}
                    {asset.tags && <span className="tag-pill">{asset.tags}</span>}
                    {asset.link && (
                      <a className="detail-chip knowledge-link" href={asset.link} target="_blank" rel="noreferrer">
                        <LinkIcon size={13} />
                        链接
                      </a>
                    )}
                  </div>
                  <div className="knowledge-actions">
                    <select
                      value={draftValue.status}
                      onChange={(event) =>
                        setAssetDrafts((current) => ({
                          ...current,
                          [asset.id]: { ...draftValue, status: event.target.value as KnowledgeAssetStatus }
                        }))
                      }
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <input
                      placeholder="备注"
                      value={draftValue.remark}
                      onChange={(event) =>
                        setAssetDrafts((current) => ({
                          ...current,
                          [asset.id]: { ...draftValue, remark: event.target.value }
                        }))
                      }
                    />
                    <button disabled={isBusy} onClick={() => handleSave(asset)} type="button">
                      <Save size={15} />
                      保存
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="empty-state">暂无知识资产。</div>
          )}
        </div>
      </section>
    </>
  );
}
