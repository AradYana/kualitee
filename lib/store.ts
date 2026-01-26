import { create } from 'zustand';
import { AppState, DataRow, KPI, EvaluationResult, EvaluationSummary, SystemLog, ValidationError } from './types';

interface AppStore extends AppState {
  // Data actions
  setSourceData: (data: DataRow[]) => void;
  setTargetData: (data: DataRow[]) => void;
  setMergedData: (data: { source: DataRow; target: DataRow }[]) => void;
  clearData: () => void;
  
  // KPI actions
  setKPIs: (kpis: KPI[]) => void;
  updateKPI: (id: number, updates: Partial<KPI>) => void;
  
  // Evaluation actions
  setEvaluationResults: (results: EvaluationResult[]) => void;
  updateEvaluationResult: (msid: string, result: EvaluationResult) => void;
  setEvaluationSummary: (summary: EvaluationSummary[]) => void;
  
  // UI actions
  setPhase: (phase: AppState['currentPhase']) => void;
  setLoading: (loading: boolean, message?: string) => void;
  
  // Log actions
  addLog: (type: SystemLog['type'], message: string) => void;
  addDataMismatch: (msid: string, field: string) => void;
  
  // Error actions
  setValidationError: (error: ValidationError | null) => void;
  
  // Terminal actions
  addTerminalEntry: (entry: string) => void;
  clearTerminal: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  sourceData: null,
  targetData: null,
  mergedData: null,
  kpis: [
    { id: 1, name: '', description: '', shortName: '' },
    { id: 2, name: '', description: '', shortName: '' },
    { id: 3, name: '', description: '', shortName: '' },
    { id: 4, name: '', description: '', shortName: '' },
  ],
  evaluationResults: null,
  evaluationSummary: null,
  currentPhase: 'UPLOAD',
  isLoading: false,
  loadingMessage: '',
  systemLogs: [],
  dataMismatchLog: [],
  validationError: null,
  terminalHistory: [],

  // Data actions
  setSourceData: (data) => set({ sourceData: data }),
  setTargetData: (data) => set({ targetData: data }),
  setMergedData: (data) => set({ mergedData: data }),
  clearData: () => set({
    sourceData: null,
    targetData: null,
    mergedData: null,
    evaluationResults: null,
    evaluationSummary: null,
    dataMismatchLog: [],
    kpis: [
      { id: 1, name: '', description: '', shortName: '' },
      { id: 2, name: '', description: '', shortName: '' },
      { id: 3, name: '', description: '', shortName: '' },
      { id: 4, name: '', description: '', shortName: '' },
    ],
  }),

  // KPI actions
  setKPIs: (kpis) => set({ kpis }),
  updateKPI: (id, updates) => set((state) => ({
    kpis: state.kpis.map((kpi) =>
      kpi.id === id ? { ...kpi, ...updates } : kpi
    ),
  })),

  // Evaluation actions
  setEvaluationResults: (results) => set({ evaluationResults: results }),
  updateEvaluationResult: (msid, result) => set((state) => ({
    evaluationResults: state.evaluationResults?.map((r) =>
      r.msid === msid ? result : r
    ) ?? [result],
  })),
  setEvaluationSummary: (summary) => set({ evaluationSummary: summary }),

  // UI actions
  setPhase: (phase) => set({ currentPhase: phase }),
  setLoading: (loading, message = '') => set({ isLoading: loading, loadingMessage: message }),

  // Log actions
  addLog: (type, message) => set((state) => ({
    systemLogs: [
      ...state.systemLogs,
      {
        timestamp: new Date().toISOString(),
        type,
        message,
      },
    ],
  })),
  addDataMismatch: (msid, field) => set((state) => ({
    dataMismatchLog: [...state.dataMismatchLog, { msid, field }],
  })),

  // Error actions
  setValidationError: (error) => set({ validationError: error }),

  // Terminal actions
  addTerminalEntry: (entry) => set((state) => ({
    terminalHistory: [...state.terminalHistory, entry],
  })),
  clearTerminal: () => set({ terminalHistory: [] }),
}));
