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
  // Data
  sourceData: DataRow[] | null;
  targetData: DataRow[] | null;
  mergedData: { source: DataRow; target: DataRow }[] | null;
  
  // KPIs
  kpis: KPI[];
  
  // Evaluation
  evaluationResults: EvaluationResult[] | null;
  evaluationSummary: EvaluationSummary[] | null;
  
  // UI State
  currentPhase: 'UPLOAD' | 'KPI_CONFIG' | 'EVALUATING' | 'RESULTS' | 'ERROR';
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
