'use client';

import { useState, useCallback, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';
import KPIConfig from '@/components/KPIConfig';
import LoadingIndicator from '@/components/LoadingIndicator';
import ErrorScreen from '@/components/ErrorScreen';
import ResultsDisplay from '@/components/ResultsDisplay';
import Terminal from '@/components/Terminal';
import ProjectsDashboard from '@/components/ProjectsDashboard';
import ProjectHub from '@/components/ProjectHub';
import Header from '@/components/Header';
import { useAppStore } from '@/lib/store';
import { DataRow, ValidationError } from '@/lib/types';

const BATCH_SIZE = 20;

export default function Home() {
  const {
    sourceData,
    targetData,
    setSourceData,
    setTargetData,
    setMergedData,
    mergedData,
    kpis,
    setKPIs,
    currentPhase,
    currentScreen,
    currentProject,
    currentTestSet,
    setPhase,
    setScreen,
    isLoading,
    loadingMessage,
    setLoading,
    validationError,
    setValidationError,
    addLog,
    addDataMismatch,
    setEvaluationResults,
    setEvaluationSummary,
    evaluationResults,
    addTerminalEntry,
    goToProjects,
    goToProjectHub,
    setCurrentTestSet,
  } = useAppStore();
  
  // Track if we should skip KPI config (when project already has KPIs)
  const [shouldAutoEvaluate, setShouldAutoEvaluate] = useState(false);

  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const [isTerminalProcessing, setIsTerminalProcessing] = useState(false);
  const [currentTestSetId, setCurrentTestSetId] = useState<string | null>(null);

  useEffect(() => {
    if (currentScreen === 'RESULTS' || currentPhase === 'RESULTS') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentScreen, currentPhase]);

  // Load results from current test set if viewing from history
  useEffect(() => {
    if (currentTestSet && currentScreen === 'RESULTS') {
      setEvaluationResults(currentTestSet.evaluationResults);
    }
  }, [currentTestSet, currentScreen, setEvaluationResults]);

  const validateAndMergeData = useCallback(() => {
    if (!sourceData || !targetData) return;

    addLog('INFO', 'Initiating data validation protocol...');

    const sourceHasMSID = sourceData.length > 0 && 'MSID' in sourceData[0];
    const targetHasMSID = targetData.length > 0 && 'MSID' in targetData[0];

    if (!sourceHasMSID || !targetHasMSID) {
      const error: ValidationError = {
        type: 'MISSING_MSID_COLUMN',
        message: `MSID column not found in ${!sourceHasMSID ? 'SOURCE_INPUT' : 'TARGET_OUTPUT'} file.`,
      };
      setValidationError(error);
      setPhase('ERROR');
      return;
    }

    const sourceMSIDs = new Set(sourceData.map((row) => row.MSID));
    const targetMSIDs = new Set(targetData.map((row) => row.MSID));

    const missingInTarget = Array.from(sourceMSIDs).filter((id) => !targetMSIDs.has(id));
    const missingInSource = Array.from(targetMSIDs).filter((id) => !sourceMSIDs.has(id));

    if (missingInTarget.length > 0 || missingInSource.length > 0) {
      const error: ValidationError = {
        type: 'MSID_PARITY_ERROR',
        message: 'MSID parity check failed. Records exist in one file but not the other.',
        details: [
          ...missingInTarget.map((id) => `MSID ${id}: Missing in TARGET_OUTPUT`),
          ...missingInSource.map((id) => `MSID ${id}: Missing in SOURCE_INPUT`),
        ],
      };
      setValidationError(error);
      setPhase('ERROR');
      return;
    }

    const merged: { source: DataRow; target: DataRow }[] = [];
    const sourceMap = new Map(sourceData.map((row) => [row.MSID, row]));

    targetData.forEach((targetRow) => {
      const sourceRow = sourceMap.get(targetRow.MSID);
      if (sourceRow) {
        merged.push({ source: sourceRow, target: targetRow });

        Object.entries(sourceRow).forEach(([key, value]) => {
          if (value === '' || value === null || value === undefined) {
            addDataMismatch(sourceRow.MSID, `SOURCE.${key}`);
          }
        });
        Object.entries(targetRow).forEach(([key, value]) => {
          if (value === '' || value === null || value === undefined) {
            addDataMismatch(targetRow.MSID, `TARGET.${key}`);
          }
        });
      }
    });

    setMergedData(merged);
    addLog('SUCCESS', `Data validation complete. ${merged.length} records merged successfully.`);
    
    // Check if project already has KPIs configured - skip KPI config if so
    if (currentProject?.kpis && currentProject.kpis.length > 0) {
      // Map project KPIs to the expected format and set them
      const projectKPIs = currentProject.kpis.map((kpi: any) => ({
        id: kpi.kpiNumber || kpi.id,
        name: kpi.name,
        description: kpi.description,
        shortName: kpi.shortName,
      }));
      setKPIs(projectKPIs);
      addLog('INFO', `Using ${projectKPIs.length} existing project KPI(s)`);
      setShouldAutoEvaluate(true);
    } else {
      setPhase('KPI_CONFIG');
      setScreen('KPI_CONFIG');
    }
  }, [sourceData, targetData, setMergedData, setValidationError, setPhase, setScreen, addLog, addDataMismatch, currentProject, setKPIs]);

  const handleUploadError = (message: string) => {
    const error: ValidationError = {
      type: 'MISSING_MSID_COLUMN',
      message,
    };
    setValidationError(error);
    setPhase('ERROR');
  };

  const runEvaluation = useCallback(async () => {
    if (!mergedData || mergedData.length === 0) return;

    setPhase('EVALUATING');
    setScreen('EVALUATING');
    setLoading(true, 'Creating test set...');

    // If we have a project, create a TestSet in the database
    let testSetId: string | null = null;
    
    if (currentProject) {
      try {
        const testSetResponse = await fetch(`/api/projects/${currentProject.id}/testsets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceData: mergedData.map(m => m.source),
            targetData: mergedData.map(m => m.target),
            kpis,
          }),
        });

        if (testSetResponse.ok) {
          const testSetData = await testSetResponse.json();
          testSetId = testSetData.testSet.id;
          setCurrentTestSetId(testSetId);
          addLog('INFO', `Test set created: ${testSetData.testSet.name}`);
        }
      } catch (error) {
        console.error('Failed to create test set:', error);
      }
    }

    // Run evaluation - use the new endpoint if we have a test set
    if (testSetId) {
      setLoading(true, 'Running evaluation...');
      
      try {
        const evalResponse = await fetch(`/api/testsets/${testSetId}/evaluate`, {
          method: 'POST',
        });

        if (evalResponse.ok) {
          const evalData = await evalResponse.json();
          addLog('SUCCESS', `Evaluation complete: ${evalData.resultCount} records (${evalData.mode} mode)`);
          
          // Fetch the complete test set with results
          const testSetDetailRes = await fetch(`/api/testsets/${testSetId}`);
          if (testSetDetailRes.ok) {
            const testSetDetail = await testSetDetailRes.json();
            setCurrentTestSet(testSetDetail.testSet);
            setEvaluationResults(testSetDetail.testSet.evaluationResults);
          }
        }
      } catch (error) {
        console.error('Evaluation failed:', error);
      }
    } else {
      // Fallback: Use the old batch evaluation for non-project flows
      const allResults: any[] = [];
      const batches = [];

      for (let i = 0; i < mergedData.length; i += BATCH_SIZE) {
        batches.push(mergedData.slice(i, i + BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        setLoading(true, `Processing batch ${i + 1} of ${batches.length}...`);

        try {
          const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              batch: batches[i],
              kpis,
            }),
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Evaluation API failed');
          }

          if (data.results && data.results.length > 0) {
            allResults.push(...data.results);
          }
        } catch (error) {
          console.error(`Batch ${i + 1} failed:`, error);
        }
      }

      if (allResults.length === 0) {
        setLoading(false);
        setPhase('KPI_CONFIG');
        setScreen('KPI_CONFIG');
        return;
      }

      setEvaluationResults(allResults);
    }

    // Generate summary
    const results = useAppStore.getState().evaluationResults;
    if (results && results.length > 0) {
      setLoading(true, 'Generating summary...');
      try {
        const summaryResponse = await fetch('/api/generate-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            results,
            kpis,
          }),
        });

        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          setEvaluationSummary(summaryData.summaries);
        }
      } catch (error) {
        console.error('Summary generation failed:', error);
      }
    }

    setLoading(false);
    setPhase('RESULTS');
    setScreen('RESULTS');
  }, [mergedData, kpis, currentProject, setPhase, setScreen, setLoading, setEvaluationResults, setEvaluationSummary, addLog, setCurrentTestSet]);

  // Auto-run evaluation when project has KPIs and data is ready
  useEffect(() => {
    if (shouldAutoEvaluate && mergedData && mergedData.length > 0 && kpis.length > 0) {
      setShouldAutoEvaluate(false);
      runEvaluation();
    }
  }, [shouldAutoEvaluate, mergedData, kpis, runEvaluation]);

  const handleTerminalQuery = useCallback(async (query: string) => {
    if (!evaluationResults || evaluationResults.length === 0) {
      addTerminalEntry('ERROR: No evaluation results available.');
      return;
    }

    setIsTerminalProcessing(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          evaluationResults,
          kpis,
          mergedData,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        addTerminalEntry(data.response);
      } else {
        addTerminalEntry('ERROR: Failed to process query. Please try again.');
      }
    } catch (error) {
      addTerminalEntry('ERROR: Network error. Please check your connection.');
    }

    setIsTerminalProcessing(false);
  }, [evaluationResults, kpis, mergedData, addTerminalEntry]);

  const handleReset = () => {
    // If in a project context, go back to project hub
    if (currentProject && currentScreen !== 'PROJECTS') {
      useAppStore.getState().clearTestFlow();
      setScreen('PROJECT_HUB');
    } else {
      // Otherwise go to projects list
      goToProjects();
    }
    setShowFailuresOnly(false);
  };

  const handleBackToProjects = () => {
    goToProjects();
  };

  // Determine if we're in a test flow (Upload, KPI Config, Evaluating, Results)
  const isInTestFlow = ['UPLOAD', 'KPI_CONFIG', 'EVALUATING', 'RESULTS'].includes(currentScreen);

  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

  const handleOpenCreateModal = () => {
    setShowCreateProjectModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateProjectModal(false);
  };

  return (
    <div className="app-container min-h-screen">
      {/* Header */}
      <Header onNewProject={currentScreen === 'PROJECTS' ? handleOpenCreateModal : undefined} />

      {/* Main Content */}
      <main className="main-content">
        {/* Error Screen Overlay */}
        {validationError && (
          <ErrorScreen
            error={validationError}
            onDismiss={() => {
              setValidationError(null);
              setPhase('UPLOAD');
              setScreen('UPLOAD');
            }}
          />
        )}

        {/* Screen: Projects Dashboard */}
        {currentScreen === 'PROJECTS' && (
          <ProjectsDashboard 
            isCreateModalOpen={showCreateProjectModal} 
            onOpenCreateModal={handleOpenCreateModal}
            onCloseCreateModal={handleCloseCreateModal} 
          />
        )}

        {/* Screen: Project Hub */}
        {currentScreen === 'PROJECT_HUB' && (
          <ProjectHub />
        )}

        {/* Screen: Upload (within project test flow) */}
        {currentScreen === 'UPLOAD' && (
          <div className="animate-fade-in">
            {currentProject && (
              <button
                onClick={() => setScreen('PROJECT_HUB')}
                className="text-white/80 hover:text-white transition-colors mb-6 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to {currentProject.name}
              </button>
            )}
            
            <div className="card">
              <div className="card-header">
                <h2 className="text-xl font-semibold text-gray-900">Data Upload</h2>
                <p className="text-sm text-gray-500 mt-1">Upload your source and target CSV files for evaluation</p>
              </div>
              <div className="card-body">
                <p className="text-sm text-gray-500 mb-6 bg-blue-50 text-blue-700 px-4 py-3 rounded-lg">
                  Both CSV files must include the <strong>MSID</strong> column as a unique identifier.
                </p>

                <div className="grid md:grid-cols-2 gap-6">
                  <FileUpload
                    label="SOURCE_INPUT"
                    onDataLoaded={(data) => {
                      setSourceData(data);
                      addLog('INFO', `SOURCE_INPUT loaded: ${data.length} records`);
                    }}
                    onError={handleUploadError}
                  />

                  <FileUpload
                    label="TARGET_OUTPUT"
                    onDataLoaded={(data) => {
                      setTargetData(data);
                      addLog('INFO', `TARGET_OUTPUT loaded: ${data.length} records`);
                    }}
                    onError={handleUploadError}
                  />
                </div>

                {sourceData && targetData && (
                  <div className="text-center mt-8">
                    <button onClick={validateAndMergeData} className="btn-primary text-lg px-8 py-3">
                      Validate & Proceed
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Screen: KPI Config */}
        {currentScreen === 'KPI_CONFIG' && (
          <div className="animate-fade-in">
            {currentProject && (
              <button
                onClick={() => setScreen('UPLOAD')}
                className="text-white/80 hover:text-white transition-colors mb-6 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Upload
              </button>
            )}
            <KPIConfig onComplete={runEvaluation} />
          </div>
        )}

        {/* Screen: Evaluating */}
        {currentScreen === 'EVALUATING' && (
          <div className="animate-fade-in">
            <LoadingIndicator message={loadingMessage} />
          </div>
        )}

        {/* Screen: Results */}
        {currentScreen === 'RESULTS' && (
          <div className="animate-fade-in">
            {currentProject && (
              <button
                onClick={() => setScreen('PROJECT_HUB')}
                className="text-white/80 hover:text-white transition-colors mb-6 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to {currentProject.name}
              </button>
            )}
            
            {currentTestSet && (
              <div className="badge badge-info mb-6">
                📊 Viewing: {currentTestSet.name}
              </div>
            )}
            
            <ResultsDisplay filterFailures={showFailuresOnly} />
            
            <div className="mt-10">
              <Terminal onCommand={handleTerminalQuery} isProcessing={isTerminalProcessing} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
