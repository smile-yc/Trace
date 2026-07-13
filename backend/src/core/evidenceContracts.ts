export interface EvidencePeriodSnapshot {
  startDate: string;
  endDate: string;
  sourceRecordIds: string[];
  projects: ProjectEvidenceSummary[];
  outcomes: OutcomeEvidenceSummary[];
  abilities: AbilityEvidenceSummary[];
}

export interface ProjectEvidenceSummary {
  id: string;
  name: string;
  status: string;
  role: string;
  timeHours: number;
  workload: number;
  recordCount: number;
  outcomeCount: number;
  lastActivityDate: string;
}

export interface OutcomeEvidenceSummary {
  id: string;
  projectId: string | null;
  type: string;
  status: string;
  title: string;
  summary: string;
  value: string;
  completionDate: string | null;
  sourceRecordIds: string[];
  abilityIds: string[];
}

export interface AbilityEvidenceSummary {
  abilityId: string;
  abilityName: string;
  timeHours: number;
  workload: number;
  outcomeIds: string[];
  milestoneIds: string[];
}
