import {
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck2,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Milestone,
  Tags,
  Target,
  type LucideIcon
} from "lucide-react";
import type { StatItem } from "../types";

interface StatCardsProps {
  items: StatItem[];
}

type StatTone = "blue" | "green" | "orange" | "violet" | "teal";

function getStatVisual(label: string): { icon: LucideIcon; tone: StatTone } {
  if (label.includes("记录")) return { icon: FileText, tone: "blue" };
  if (label.includes("日报")) return { icon: FileText, tone: "blue" };
  if (label.includes("完成")) return { icon: CheckCircle2, tone: "green" };
  if (label.includes("月份") || label.includes("天数") || label.includes("周期")) {
    return { icon: CalendarCheck2, tone: "green" };
  }
  if (label.includes("当量") || label.includes("工作量")) {
    return { icon: BriefcaseBusiness, tone: "orange" };
  }
  if (label.includes("工时") || label.includes("时间") || label.includes("投入")) {
    return { icon: Clock3, tone: "blue" };
  }
  if (label.includes("项目")) return { icon: FolderKanban, tone: "violet" };
  if (label.includes("成果")) return { icon: Award, tone: "teal" };
  if (label.includes("里程碑")) return { icon: Milestone, tone: "green" };
  if (label.includes("提醒")) return { icon: AlertTriangle, tone: "orange" };
  if (label.includes("证据")) return { icon: FileText, tone: "teal" };
  if (label.includes("目标")) return { icon: Target, tone: "violet" };
  if (label.includes("标签")) return { icon: Tags, tone: "violet" };
  if (label.includes("能力")) return { icon: Target, tone: "teal" };
  if (label.includes("知识") || label.includes("资产")) return { icon: BookOpen, tone: "green" };
  return { icon: Activity, tone: "blue" };
}

export function StatCards({ items }: StatCardsProps) {
  return (
    <section className="stat-grid" aria-label="统计数据">
      {items.map((item) => {
        const { icon: Icon, tone } = getStatVisual(item.label);

        return (
          <div className={`stat-card tone-${tone}`} key={item.label}>
            <span className="stat-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <span className="stat-label">{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        );
      })}
    </section>
  );
}
