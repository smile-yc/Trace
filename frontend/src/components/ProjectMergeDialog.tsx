import { useEffect, useMemo, useState } from "react";
import { fetchProjectMergePreview, mergeProjects } from "../lib/projectApi";
import { toProjectSearchOptions } from "../lib/projectPresentation";
import type { Project, ProjectMergePreview } from "../types";
import { Button, ErrorState, ModalDialog, SearchSelect } from "./ui";

interface ProjectMergeDialogProps {
  open: boolean;
  sourceId: string;
  projects: Project[];
  onClose: () => void;
  onMerged: (project: Project) => void | Promise<void>;
}

const confirmationText = "合并后，来源项目的工作记录将关联到目标项目，历史项目名称快照保持不变。确认继续吗？";

export function ProjectMergeDialog({ open, sourceId, projects, onClose, onMerged }: ProjectMergeDialogProps) {
  const [targetId, setTargetId] = useState("");
  const [preview, setPreview] = useState<ProjectMergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetOptions = useMemo(
    () => toProjectSearchOptions(projects.filter((project) => project.id !== sourceId && !project.mergedIntoProjectId)),
    [projects, sourceId]
  );

  useEffect(() => {
    setTargetId("");
    setPreview(null);
    setError(null);
  }, [open, sourceId]);

  useEffect(() => {
    if (!open || !targetId) {
      setPreview(null);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    fetchProjectMergePreview(sourceId, targetId)
      .then((nextPreview) => {
        if (mounted) setPreview(nextPreview);
      })
      .catch((reason) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "合并预览读取失败");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, sourceId, targetId]);

  async function handleConfirm(): Promise<void> {
    if (!preview || !window.confirm(confirmationText)) return;
    setLoading(true);
    setError(null);
    try {
      const target = await mergeProjects(sourceId, targetId);
      await onMerged(target);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "项目合并失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalDialog
      open={open}
      title="合并项目"
      onClose={onClose}
      footer={(
        <>
          <Button disabled={loading} onClick={onClose}>取消</Button>
          <Button disabled={!preview} loading={loading} variant="danger" onClick={handleConfirm}>确认合并</Button>
        </>
      )}
    >
      <div className="project-merge-content">
        <label>
          <span>目标项目</span>
          <SearchSelect
            ariaLabel="选择合并目标项目"
            disabled={loading}
            options={targetOptions}
            placeholder="搜索目标项目"
            value={targetId}
            onChange={setTargetId}
          />
        </label>
        {error && <ErrorState compact title="合并预览失败" description={error} />}
        {preview && (
          <div className="project-merge-preview">
            <p><strong>{preview.sourceProject.name}</strong> 将合并到 <strong>{preview.targetProject.name}</strong></p>
            <dl>
              <div><dt>记录数</dt><dd>{preview.recordCount}</dd></div>
              <div><dt>工时</dt><dd>{preview.timeHours.toFixed(1)} h</dd></div>
              <div><dt>原始工作当量</dt><dd>{preview.workload.toFixed(2)}</dd></div>
            </dl>
            <p className="project-merge-warning">{confirmationText}</p>
          </div>
        )}
      </div>
    </ModalDialog>
  );
}
