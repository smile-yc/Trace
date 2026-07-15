import { FormEvent, useEffect, useState } from "react";
import type { Project, ProjectInput, ProjectStatus } from "../types";
import { Button, FormField } from "./ui";

interface ProjectEditorProps {
  project?: Project;
  busy?: boolean;
  onCancel: () => void;
  onSubmit: (input: ProjectInput) => void | Promise<void>;
}

const emptyInput: ProjectInput = { name: "", status: "active" };

export function ProjectEditor({ project, busy = false, onCancel, onSubmit }: ProjectEditorProps) {
  const [input, setInput] = useState<ProjectInput>(emptyInput);

  useEffect(() => {
    setInput(project ? {
      name: project.name,
      shortName: project.shortName,
      status: project.status,
      startDate: project.startDate,
      endDate: project.endDate,
      personalRole: project.personalRole,
      goal: project.goal,
      description: project.description,
      completionSummary: project.completionSummary,
      aliases: project.aliases
    } : emptyInput);
  }, [project]);

  function update<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]): void {
    setInput((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!input.name.trim()) return;
    await onSubmit({ ...input, name: input.name.trim(), shortName: input.shortName?.trim() });
  }

  return (
    <form className="project-editor" onSubmit={handleSubmit}>
      <div className="project-editor-grid">
        <FormField label="项目名称" required>
          <input value={input.name} onChange={(event) => update("name", event.target.value)} />
        </FormField>
        <FormField label="项目简称">
          <input value={input.shortName ?? ""} onChange={(event) => update("shortName", event.target.value)} />
        </FormField>
        <FormField label="状态">
          <select value={input.status ?? "active"} onChange={(event) => update("status", event.target.value as ProjectStatus)}>
            <option value="planned">计划中</option>
            <option value="active">进行中</option>
            <option value="paused">已暂停</option>
            <option value="completed">已完成</option>
          </select>
        </FormField>
        <FormField label="个人角色">
          <input value={input.personalRole ?? ""} onChange={(event) => update("personalRole", event.target.value)} />
        </FormField>
        <FormField label="开始日期">
          <input type="date" value={input.startDate ?? ""} onChange={(event) => update("startDate", event.target.value)} />
        </FormField>
        <FormField label="结束日期">
          <input type="date" value={input.endDate ?? ""} onChange={(event) => update("endDate", event.target.value)} />
        </FormField>
      </div>
      <FormField label="项目目标">
        <textarea rows={2} value={input.goal ?? ""} onChange={(event) => update("goal", event.target.value)} />
      </FormField>
      <FormField label="项目说明">
        <textarea rows={3} value={input.description ?? ""} onChange={(event) => update("description", event.target.value)} />
      </FormField>
      {(project?.status === "completed" || input.status === "completed") && (
        <FormField label="结项总结">
          <textarea rows={5} value={input.completionSummary ?? ""} onChange={(event) => update("completionSummary", event.target.value)} />
        </FormField>
      )}
      <div className="project-editor-actions">
        <Button disabled={busy} onClick={onCancel}>取消</Button>
        <Button loading={busy} type="submit" variant="primary">{project ? "保存" : "新建项目"}</Button>
      </div>
    </form>
  );
}
