import { BarChart3, CheckCircle2, FileText, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { buildAutomaticReportSummary, buildReportInsights } from "../lib/reportInsights";
import { fetchReportReview, saveReportReview } from "../lib/reportReviewApi";
import type { Outcome, ReportReviewInput, ReportReviewStatus, ReportReviewType, WorkRecord } from "../types";

interface ReportReviewWorkspaceProps {
  reportType: ReportReviewType;
  periodKey: string;
  currentRecords: WorkRecord[];
  previousRecords: WorkRecord[];
  outcomes: Outcome[];
  onNotify: (message: string) => void;
}

type ReviewFields = Pick<ReportReviewInput, "achievements" | "shortcomings" | "causes" | "improvements" | "growth" | "nextPlan">;
type ReviewMode = "data" | "report";

const emptyFields: Required<ReviewFields> = {
  achievements: "", shortcomings: "", causes: "", improvements: "", growth: "", nextPlan: ""
};

const fieldLabels: Array<{ key: keyof Required<ReviewFields>; label: string; placeholder: string }> = [
  { key: "achievements", label: "成绩与贡献", placeholder: "本周期完成了什么，产生了什么价值" },
  { key: "shortcomings", label: "不足", placeholder: "哪些目标未达成，哪些工作质量仍需提高" },
  { key: "causes", label: "原因", placeholder: "从资源、方法、协作和个人投入分析原因" },
  { key: "improvements", label: "改进措施", placeholder: "下一周期采取哪些具体行动" },
  { key: "growth", label: "成长与能力", placeholder: "掌握的新技能、新方法和能力变化" },
  { key: "nextPlan", label: "下一周期规划", placeholder: "明确重点、目标和预期成果" }
];

function valueLabel(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function ReportReviewWorkspace({ reportType, periodKey, currentRecords, previousRecords, outcomes, onNotify }: ReportReviewWorkspaceProps) {
  const [mode, setMode] = useState<ReviewMode>("data");
  const [fields, setFields] = useState<Required<ReviewFields>>(emptyFields);
  const [status, setStatus] = useState<ReportReviewStatus>("draft");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const insights = useMemo(() => buildReportInsights(currentRecords, previousRecords, outcomes), [currentRecords, previousRecords, outcomes]);
  const automaticSummary = useMemo(() => buildAutomaticReportSummary(insights), [insights]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetchReportReview(reportType, periodKey).then((review) => {
      if (ignore) return;
      setFields(review ? {
        achievements: review.achievements, shortcomings: review.shortcomings, causes: review.causes,
        improvements: review.improvements, growth: review.growth, nextPlan: review.nextPlan
      } : emptyFields);
      setStatus(review?.status ?? "draft");
    }).catch((error) => {
      if (!ignore) onNotify(error instanceof Error ? error.message : "复盘草稿读取失败");
    }).finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [reportType, periodKey, onNotify]);

  async function persist(nextStatus: ReportReviewStatus, nextFields = fields): Promise<void> {
    setSaving(true);
    try {
      const review = await saveReportReview({ reportType, periodKey, ...nextFields, status: nextStatus });
      setStatus(review.status);
      setFields({
        achievements: review.achievements, shortcomings: review.shortcomings, causes: review.causes,
        improvements: review.improvements, growth: review.growth, nextPlan: review.nextPlan
      });
      onNotify(nextStatus === "final" ? "复盘已确认定稿" : "复盘草稿已保存");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "复盘保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function clearReview(): Promise<void> {
    if (!window.confirm("确认清空本周期手工复盘内容？自动统计不会受影响。")) return;
    setFields(emptyFields);
    await persist("draft", emptyFields);
  }

  return <section className="panel report-review-workspace">
    <div className="panel-heading">
      <div><h2>复盘与行动</h2><span>{status === "final" ? "已定稿" : "草稿"}{loading ? " · 读取中" : ""}</span></div>
      <div className="report-mode-switch" role="tablist" aria-label="报告视图">
        <button aria-selected={mode === "data"} className={mode === "data" ? "active" : ""} onClick={() => setMode("data")} role="tab" type="button"><BarChart3 size={15} />数据判断</button>
        <button aria-selected={mode === "report"} className={mode === "report" ? "active" : ""} onClick={() => setMode("report")} role="tab" type="button"><FileText size={15} />汇报内容</button>
      </div>
    </div>

    {mode === "data" ? <>
      <div className="report-comparison-grid">
        {insights.comparison.map((item) => <details key={item.key}>
          <summary><span>{item.label}</span><strong>{valueLabel(item.current)}</strong><small className={item.deltaPercent >= 0 ? "positive" : "negative"}>{item.deltaPercent >= 0 ? "+" : ""}{item.deltaPercent}% 环比</small></summary>
          <p>上期：{valueLabel(item.previous)}。本期统计来源共 {currentRecords.length} 条记录。</p>
          <ul>{currentRecords.slice(0, 12).map((record) => <li key={record.id}>{record.date} · {record.title}</li>)}</ul>
        </details>)}
      </div>
      <div className="report-judgement-grid">
        <details><summary><span>投入集中度</span><strong>{insights.concentration.share}%</strong><small>{insights.concentration.projectName}</small></summary><ul>{insights.concentration.records.map((record) => <li key={record.id}>{record.date} · {record.title}</li>)}</ul></details>
        <details><summary><span>投入产出</span><strong>{insights.output.completedOutcomeCount} 项成果</strong><small>{insights.output.completedOutcomeCount ? (insights.output.linkedRecordCount ? `${insights.output.linkedRecordCount} 条来源 / ${valueLabel(insights.output.linkedWorkload)} 关联当量` : "缺少当前周期关联记录") : "尚无成果证据"}</small></summary><ul>{insights.output.outcomes.map((outcome) => <li key={outcome.id}>{outcome.completedDate || outcome.updateDate} · {outcome.title}</li>)}</ul></details>
      </div>
      <div className="report-reminders"><h3>下一步提醒</h3>{insights.reminders.map((message) => <p key={message}>{message}</p>)}{!insights.reminders.length && <p>当前没有需要特别处理的提醒。</p>}</div>
    </> : <>
      <div className="automatic-report-summary"><strong>自动摘要</strong><p>{automaticSummary}</p><small>自动内容来自源记录和成果，不会被手工复盘覆盖。</small></div>
      <div className="report-review-fields">
        {fieldLabels.map((field) => <label key={field.key}><span>{field.label}</span><textarea placeholder={field.placeholder} value={fields[field.key]} onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))} /></label>)}
      </div>
      <div className="report-review-actions">
        <button disabled={saving} onClick={() => void persist("draft")} type="button"><Save size={15} />保存草稿</button>
        <button className="primary-button" disabled={saving} onClick={() => void persist("final")} type="button"><CheckCircle2 size={15} />确认定稿</button>
        <button disabled={saving} onClick={() => void clearReview()} type="button"><RotateCcw size={15} />清空手工内容</button>
      </div>
    </>}
  </section>;
}
