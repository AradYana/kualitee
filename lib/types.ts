export interface DataRow {
  MSID: string;
  [key: string]: string | number | undefined;
}

export interface KPI {
  id: number;
  name: string;
  description: string;
  shortName: string;
}

// Project-based types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  kpis: ProjectKPI[];
  testSetCount?: number;
  lastTestSet?: {
    id: string;
    name: string;
    createdAt: string;
  } | null;
}

export interface ProjectKPI {
  id: string;
  projectId: string;
  kpiNumber: number;
  name: string;
  description: string;
  shortName: string;
}

export interface TestSet {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  kpis?: KPI[];
  resultCount?: number;
  rowCount?: number;
  overallScore?: number;
}

export interface TestSetDetail extends TestSet {
  project: {
    id: string;
    name: string;
  };
  sourceData: DataRow[];
  targetData: DataRow[];
  evaluationResults: EvaluationResult[];
  summaryStats: SummaryStats[];
  dataMismatches: DataMismatchEntry[];
}

export interface SummaryStats {
  kpiId: number;
  kpiName: string;
  shortName: string;
  mean: number;
  median: number;
  count: number;
}

export interface DataMismatchEntry {
  id: string;
  testSetId: string;
  msid: string;
  field: string;
  issue: string;
}

export interface EvaluationResult {
  msid: string;
  scores: {
    kpiId: number;
    score: number;
    explanation: string;
  }[];
  dataMismatch?: string[];
}

export interface EvaluationSummary {
  kpiId: number;
  kpiName: string;
  shortName: string;
  averageScore: number;
  shortExplanation: string;
}

export interface SystemLog {
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message: string;
}

export interface ValidationError {
  type: 'MISSING_MSID_COLUMN' | 'MSID_PARITY_ERROR' | 'DATA_MISMATCH';
  message: string;
  details?: string[];
}

export interface AppState {
  // Project context
  currentProject: Project | null;
  currentTestSet: TestSetDetail | null;
  
  // Data (for current test flow)
  sourceData: DataRow[] | null;
  targetData: DataRow[] | null;
  mergedData: { source: DataRow; target: DataRow }[] | null;
  
  // KPIs (for current test flow)
  kpis: KPI[];
  
  // Evaluation
  evaluationResults: EvaluationResult[] | null;
  evaluationSummary: EvaluationSummary[] | null;
  
  // UI State - extended with project screens
  currentScreen: 'PROJECTS' | 'PROJECT_HUB' | 'UPLOAD' | 'KPI_CONFIG' | 'EVALUATING' | 'RESULTS' | 'ERROR';
  currentPhase: 'UPLOAD' | 'KPI_CONFIG' | 'EVALUATING' | 'RESULTS' | 'ERROR'; // Legacy, maps to screen
  isLoading: boolean;
  loadingMessage: string;
  
  // Logs
  systemLogs: SystemLog[];
  dataMismatchLog: { msid: string; field: string }[];
  
  // Errors
  validationError: ValidationError | null;
  
  // Terminal history
  terminalHistory: string[];
}

export interface EvaluationRequest {
  sourceRow: DataRow;
  targetRow: DataRow;
  kpis: KPI[];
}

export interface EvaluationResponse {
  msid: string;
  scores: {
    kpiId: number;
    score: number;
    explanation: string;
  }[];
}
