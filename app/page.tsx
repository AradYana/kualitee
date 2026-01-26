'use client';

import { useState, useCallback, useEffect } from 'react';
import ASCIIHeader from '@/components/ASCIIHeader';
import FileUpload from '@/components/FileUpload';
import KPIConfig from '@/components/KPIConfig';
import LoadingIndicator from '@/components/LoadingIndicator';
import ErrorScreen from '@/components/ErrorScreen';
import ResultsDisplay from '@/components/ResultsDisplay';
import Terminal from '@/components/Terminal';
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
    setPhase,
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
  } = useAppStore();

  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const [isTerminalProcessing, setIsTerminalProcessing] = useState(false);

  useEffect(() => {
    if (currentPhase === 'RESULTS') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPhase]);

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

    const missingInTarget = [...sourceMSIDs].filter((id) => !targetMSIDs.has(id));
    const missingInSource = [...targetMSIDs].filter((id) => !sourceMSIDs.has(id));

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
  }, [sourceData, targetData, setMergedData, setValidationError, setPhase, addLog, addDataMismatch]);

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
    setLoading(true, 'Evaluating records...');

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
      return;
    }

    setEvaluationResults(allResults);

    setLoading(true, 'Generating summary...');
    try {
      const summaryResponse = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results: allResults,
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

    setLoading(false);
    setPhase('RESULTS');
  }, [mergedData, kpis, setPhase, setLoading, setEvaluationResults, setEvaluationSummary]);

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
    useAppStore.getState().clearData();
    useAppStore.getState().clearTerminal();
    setPhase('UPLOAD');
    setShowFailuresOnly(false);
  };

  return (
    <div className="min-h-screen py-6 px-4" style={{ backgroundColor: '#cec5b4' }}>
      {/* Main Window */}
      <div className="main-window max-w-5xl mx-auto">
        {/* Title Bar */}
        <div className="title-bar">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔷</span>
            <span>Kualitee - Automated LLM QA System v1.0</span>
          </div>
          <div className="title-bar-controls">
            <button className="title-bar-btn" title="Minimize">─</button>
            <button className="title-bar-btn" title="Maximize">□</button>
            <button className="title-bar-btn" onClick={handleReset} title="Reset">×</button>
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
              }}
            />
          )}

          {/* Status Message */}
          {currentPhase === 'UPLOAD' && !evaluationResults && (
            <p className="text-center status-text mb-6">
              Welcome! No evaluation results are available yet. Get started below.
            </p>
          )}

          {/* Main Content */}
          <div className="space-y-6">
            {/* Phase: Upload */}
            {currentPhase === 'UPLOAD' && (
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
            )}

            {/* Phase: KPI Config */}
            {currentPhase === 'KPI_CONFIG' && (
              <KPIConfig onComplete={runEvaluation} />
            )}

            {/* Phase: Evaluating */}
            {currentPhase === 'EVALUATING' && (
              <LoadingIndicator message={loadingMessage} />
            )}

            {/* Phase: Results */}
            {currentPhase === 'RESULTS' && (
              <ResultsDisplay filterFailures={showFailuresOnly} />
            )}

            {/* Terminal - Only visible after results */}
            {currentPhase === 'RESULTS' && (
              <div className="mt-8">
                <div className="down-indicator mb-4">
                  ▼ SCROLL DOWN FOR FEEDBACK TERMINAL ▼
                </div>
                <Terminal onCommand={handleTerminalQuery} isProcessing={isTerminalProcessing} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
