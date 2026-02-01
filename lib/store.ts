import { create } from 'zustand';
import { AppState, DataRow, KPI, EvaluationResult, EvaluationSummary, SystemLog, ValidationError, Project, TestSetDetail } from './types';

interface AppStore extends AppState {
  // Project actions
  setCurrentProject: (project: Project | null) => void;
  setCurrentTestSet: (testSet: TestSetDetail | null) => void;
  setScreen: (screen: AppState['currentScreen']) => void;
  
  // Data actions
  setSourceData: (data: DataRow[]) => void;
  setTargetData: (data: DataRow[]) => void;
  setMergedData: (data: { source: DataRow; target: DataRow }[]) => void;
  clearData: () => void;
  clearTestFlow: () => void;
  
  // KPI actions
  setKPIs: (kpis: KPI[]) => void;
  updateKPI: (id: number, updates: Partial<KPI>) => void;
  prefillKPIsFromProject: () => void;
  
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
  
  // Navigation helpers
  goToProjects: () => void;
  goToProjectHub: (project: Project) => void;
  startNewTest: () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  currentProject: null,
  currentTestSet: null,
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
  currentScreen: 'PROJECTS',
  currentPhase: 'UPLOAD',
  isLoading: false,
  loadingMessage: '',
  systemLogs: [],
  dataMismatchLog: [],
  validationError: null,
  terminalHistory: [],

  // Project actions
  setCurrentProject: (project) => set({ currentProject: project }),
  setCurrentTestSet: (testSet) => set({ currentTestSet: testSet }),
  setScreen: (screen) => set({ currentScreen: screen }),

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
  clearTestFlow: () => set({
    sourceData: null,
    targetData: null,
    mergedData: null,
    evaluationResults: null,
    evaluationSummary: null,
    dataMismatchLog: [],
    currentTestSet: null,
    terminalHistory: [],
    systemLogs: [],
    validationError: null,
  }),

  // KPI actions
  setKPIs: (kpis) => set({ kpis }),
  updateKPI: (id, updates) => set((state) => ({
    kpis: state.kpis.map((kpi) =>
      kpi.id === id ? { ...kpi, ...updates } : kpi
    ),
  })),
  prefillKPIsFromProject: () => {
    const { currentProject } = get();
    if (currentProject && currentProject.kpis.length > 0) {
      const prefilled = currentProject.kpis.map((kpi) => ({
        id: kpi.kpiNumber,
        name: kpi.name,
        description: kpi.description,
        shortName: kpi.shortName,
      }));
      // Pad with empty KPIs if less than 4
      while (prefilled.length < 4) {
        prefilled.push({
          id: prefilled.length + 1,
          name: '',
          description: '',
          shortName: '',
        });
      }
      set({ kpis: prefilled });
    }
  },

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

  // Navigation helpers
  goToProjects: () => set({
    currentScreen: 'PROJECTS',
    currentProject: null,
    currentTestSet: null,
    sourceData: null,
    targetData: null,
    mergedData: null,
    evaluationResults: null,
    evaluationSummary: null,
    dataMismatchLog: [],
    terminalHistory: [],
    systemLogs: [],
    validationError: null,
  }),
  goToProjectHub: (project) => set({
    currentScreen: 'PROJECT_HUB',
    currentProject: project,
    currentTestSet: null,
  }),
  startNewTest: () => {
    const { prefillKPIsFromProject } = get();
    prefillKPIsFromProject();
    set({
      currentScreen: 'UPLOAD',
      currentPhase: 'UPLOAD',
      sourceData: null,
      targetData: null,
      mergedData: null,
      evaluationResults: null,
      evaluationSummary: null,
      dataMismatchLog: [],
      terminalHistory: [],
      systemLogs: [],
      validationError: null,
      currentTestSet: null,
    });
  },
}));
