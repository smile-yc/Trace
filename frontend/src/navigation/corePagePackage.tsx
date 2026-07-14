import { AllRecordsPage } from "../pages/AllRecordsPage";
import { DailyPage } from "../pages/DailyPage";
import { GrowthPage } from "../pages/GrowthPage";
import { KnowledgePage } from "../pages/KnowledgePage";
import { MonthlyPage } from "../pages/MonthlyPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { WeeklyPage } from "../pages/WeeklyPage";
import { YearlyPage } from "../pages/YearlyPage";
import type { AppPageContext } from "./appPageContext";
import type { DomainPagePackage } from "./pageRegistry";

export const CORE_PAGE_PACKAGES: ReadonlyArray<DomainPagePackage<AppPageContext>> = [
  {
    id: "work-outcomes",
    pages: [
      {
        id: "daily",
        label: "今日工作台",
        group: "records",
        render: (context) => (
          <DailyPage
            records={context.records}
            onAdd={context.onAddRecord}
            onEdit={context.onEditRecord}
            onDelete={context.onDeleteRecord}
            onNotify={context.onNotify}
            onCreateOutcome={context.onCreateOutcome}
          />
        )
      },
      {
        id: "all",
        label: "工作台账",
        group: "records",
        render: (context) => (
          <AllRecordsPage
            records={context.records}
            onEdit={context.onEditRecord}
            onDelete={context.onDeleteRecord}
            onClear={context.onClearRecords}
            onGenerateReport={context.onGenerateReport}
            onCreateOutcome={context.onCreateOutcome}
          />
        )
      },
      {
        id: "projects",
        label: "项目管理",
        group: "work",
        render: (context) => <ProjectsPage onNotify={context.onNotify} onCreateOutcome={context.onCreateOutcome} />
      },
      {
        id: "knowledge",
        label: "成果管理",
        group: "work",
        render: (context) => <KnowledgePage records={context.records} initialSeed={context.outcomeSeed} onSeedConsumed={context.onOutcomeSeedConsumed} onNotify={context.onNotify} />
      }
    ]
  },
  {
    id: "growth-reports",
    pages: [
      {
        id: "weekly",
        label: "周报",
        group: "review",
        render: (context) => <WeeklyPage records={context.records} onGenerateReport={context.onGenerateReport} onNotify={context.onNotify} />
      },
      {
        id: "monthly",
        label: "月报",
        group: "review",
        render: (context) => <MonthlyPage records={context.records} onGenerateReport={context.onGenerateReport} onNotify={context.onNotify} />
      },
      {
        id: "yearly",
        label: "年报",
        group: "review",
        render: (context) => <YearlyPage records={context.records} onGenerateReport={context.onGenerateReport} onNotify={context.onNotify} />
      },
      {
        id: "growth",
        label: "成长与目标",
        group: "growth",
        render: (context) => <GrowthPage records={context.records} onNotify={context.onNotify} />
      }
    ]
  },
  {
    id: "settings-data",
    pages: [
      {
        id: "settings",
        label: "配置与数据",
        group: "system",
        render: (context) => <SettingsPage onNotify={context.onNotify} />
      }
    ]
  }
];
