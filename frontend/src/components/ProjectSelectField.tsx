import { Plus } from "lucide-react";
import { useState } from "react";
import { toProjectSearchOptions } from "../lib/projectPresentation";
import type { Project, ProjectInput, ProjectRelation } from "../types";
import { Button, ModalDialog, SearchSelect } from "./ui";
import { ProjectEditor } from "./ProjectEditor";

interface ProjectSelectFieldProps {
  projects: Project[];
  projectId: string;
  relation: ProjectRelation;
  busy?: boolean;
  error?: string | null;
  onChange: (projectId: string, relation: ProjectRelation) => void;
  onQuickCreate: (input: ProjectInput) => void | Promise<void>;
}

export function ProjectSelectField({
  projects,
  projectId,
  relation,
  busy = false,
  error,
  onChange,
  onQuickCreate
}: ProjectSelectFieldProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const options = toProjectSearchOptions(projects);
  const relationMessage = error
    ?? (relation === "project" && !projectId
      ? "项目事项：必须选择一个项目"
      : relation === "non_project"
        ? "非项目事项：无需项目"
        : relation === "unassigned"
          ? "历史未关联：请选择项目或改为非项目事项"
          : null);

  return (
    <div className="project-select-field">
      <div className="project-relation-toggle" role="group" aria-label="事项类型">
        <button
          className={relation === "project" ? "is-active" : ""}
          type="button"
          aria-pressed={relation === "project"}
          onClick={() => onChange(projectId, "project")}
        >
          项目事项
        </button>
        <button
          className={relation === "non_project" ? "is-active" : ""}
          type="button"
          aria-pressed={relation === "non_project"}
          onClick={() => onChange("", "non_project")}
        >
          非项目事项
        </button>
      </div>
      {relation !== "non_project" && (
        <div className="project-select-row">
          <SearchSelect
            ariaLabel="选择项目"
            disabled={busy}
            emptyText="没有匹配项目"
            options={options}
            placeholder="搜索并选择项目"
            searchPlaceholder="搜索名称、简称或别名"
            value={projectId}
            onChange={(value) => onChange(value, "project")}
          />
          <Button className="project-quick-create" leadingIcon={<Plus size={16} />} onClick={() => setEditorOpen(true)}>
            新建项目
          </Button>
        </div>
      )}
      {relationMessage && (
        <div className={error || relation !== "non_project" ? "ui-field-error" : "ui-field-hint"} role={error ? "alert" : undefined}>
          {relationMessage}
        </div>
      )}
      <ModalDialog open={editorOpen} title="新建项目" onClose={() => setEditorOpen(false)}>
        <ProjectEditor
          busy={busy}
          onCancel={() => setEditorOpen(false)}
          onSubmit={async (input) => {
            await onQuickCreate(input);
            setEditorOpen(false);
          }}
        />
      </ModalDialog>
    </div>
  );
}
