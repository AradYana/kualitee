'use client';

import { useState, useCallback, useEffect } from 'react';
import ASCIIHeader from '@/components/ASCIIHeader';
import FileUpload from '@/components/FileUpload';
import KPIConfig from '@/components/KPIConfig';
import LoadingIndicator from '@/components/LoadingIndicator';
import ErrorScreen from '@/components/ErrorScreen';
import ResultsDisplay from '@/components/ResultsDisplay';
import Terminal from '@/components/Terminal';
import ProjectsDashboard from '@/components/ProjectsDashboard';
import ProjectHub from '@/components/ProjectHub';
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
    setPhase('KPI_CONFIG');
    setScreen('KPI_CONFIG');
  }, [sourceData, targetData, setMergedData, setValidationError, setPhase, setScreen, addLog, addDataMismatch]);

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

  return (
    <div className="min-h-screen py-6 px-4" style={{ backgroundColor: '#cec5b4' }}>
      {/* Main Window */}
      <div className="main-window max-w-5xl mx-auto">
        {/* Title Bar */}
        <div className="title-bar">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔷</span>
            <span>Kualitee - Automated LLM QA System v1.0</span>
            {currentProject && (
              <span className="text-xs opacity-75">
                | {currentProject.name}
              </span>
            )}
          </div>
          <div className="title-bar-controls">
            <button className="title-bar-btn" title="Minimize">─</button>
            <button className="title-bar-btn" title="Maximize">□</button>
            {currentScreen !== 'PROJECTS' && (
              <button className="title-bar-btn" onClick={handleReset} title="Close / Back">×</button>
            )}
          </div>
        </div>

        {/* Window Content */}
        <div className="p-6" style={{ backgroundColor: '#e6e0d4' }}>
          {/* Header */}
          <ASCIIHeader />

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

          {/* Main Content */}
          <div className="space-y-6">
            {/* Screen: Projects Dashboard */}
            {currentScreen === 'PROJECTS' && (
              <ProjectsDashboard />
            )}

            {/* Screen: Project Hub */}
            {currentScreen === 'PROJECT_HUB' && (
              <ProjectHub />
            )}

            {/* Screen: Upload (within project test flow) */}
            {currentScreen === 'UPLOAD' && (
              <div className="space-y-4">
                {currentProject && (
                  <button
                    onClick={() => setScreen('PROJECT_HUB')}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ← Back to {currentProject.name}
                  </button>
                )}
                
                <div className="bevel-panel rounded-terminal p-5">
                  <h2 className="text-lg font-semibold mb-4 text-text-primary">
                    📁 Data Upload
                  </h2>
                  <p className="text-sm text-text-secondary mb-4">
                    Both CSV files must include the MSID column.
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
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
                    <div className="text-center mt-6">
                      <button onClick={validateAndMergeData} className="send-btn">
                        Validate & Proceed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Screen: KPI Config */}
            {currentScreen === 'KPI_CONFIG' && (
              <div className="space-y-4">
                {currentProject && (
                  <button
                    onClick={() => setScreen('UPLOAD')}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ← Back to Upload
                  </button>
                )}
                <KPIConfig onComplete={runEvaluation} />
              </div>
            )}

            {/* Screen: Evaluating */}
            {currentScreen === 'EVALUATING' && (
              <LoadingIndicator message={loadingMessage} />
            )}

            {/* Screen: Results */}
            {currentScreen === 'RESULTS' && (
              <div className="space-y-4">
                {currentProject && (
                  <button
                    onClick={() => setScreen('PROJECT_HUB')}
                    className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    ← Back to {currentProject.name}
                  </button>
                )}
                
                {currentTestSet && (
                  <div className="suggestion-chip inline-block mb-4">
                    📊 Viewing: {currentTestSet.name}
                  </div>
                )}
                
                <ResultsDisplay filterFailures={showFailuresOnly} />
                
                <div className="mt-8">
                  <div className="down-indicator mb-4">
                    ▼ SCROLL DOWN FOR FEEDBACK TERMINAL ▼
                  </div>
                  <Terminal onCommand={handleTerminalQuery} isProcessing={isTerminalProcessing} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="win95-statusbar flex justify-between">
          <span>
            {currentScreen === 'PROJECTS' && 'Select or create a project'}
            {currentScreen === 'PROJECT_HUB' && `Project: ${currentProject?.name}`}
            {currentScreen === 'UPLOAD' && 'Upload source and target CSV files'}
            {currentScreen === 'KPI_CONFIG' && 'Configure evaluation criteria'}
            {currentScreen === 'EVALUATING' && 'Evaluation in progress...'}
            {currentScreen === 'RESULTS' && `${evaluationResults?.length || 0} records evaluated`}
          </span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
