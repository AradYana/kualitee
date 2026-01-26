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

  // Scroll to top when results are ready
  useEffect(() => {
    if (currentPhase === 'RESULTS') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPhase]);

  // Validate and merge data
  const validateAndMergeData = useCallback(() => {
    if (!sourceData || !targetData) return;

    addLog('INFO', 'Initiating data validation protocol...');

    // Check for MSID column
    const sourceHasMSID = sourceData.length > 0 && 'MSID' in sourceData[0];
    const targetHasMSID = targetData.length > 0 && 'MSID' in targetData[0];

    if (!sourceHasMSID || !targetHasMSID) {
      const error: ValidationError = {
        type: 'MISSING_MSID_COLUMN',
        message: `MSID column not found in ${!sourceHasMSID ? 'SOURCE_INPUT' : 'TARGET_OUTPUT'} file.`,
      };
      setValidationError(error);
      setPhase('ERROR');
      addLog('ERROR', 'MSID COLUMN NOT FOUND - PROCESS HALTED');
      return;
    }

    // Check MSID parity
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
      addLog('ERROR', `MSID PARITY ERROR - ${missingInTarget.length + missingInSource.length} mismatches found`);
      return;
    }

    // Merge data and check for empty cells
    const merged: { source: DataRow; target: DataRow }[] = [];
    const sourceMap = new Map(sourceData.map((row) => [row.MSID, row]));

    targetData.forEach((targetRow) => {
      const sourceRow = sourceMap.get(targetRow.MSID);
      if (sourceRow) {
        merged.push({ source: sourceRow, target: targetRow });

        // Check for empty cells
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
    addLog('INFO', 'Proceeding to KPI configuration...');
    setPhase('KPI_CONFIG');
  }, [sourceData, targetData, setMergedData, setValidationError, setPhase, addLog, addDataMismatch]);

  // Handle file upload errors
  const handleUploadError = (message: string) => {
    const error: ValidationError = {
      type: 'MISSING_MSID_COLUMN',
      message,
    };
    setValidationError(error);
    setPhase('ERROR');
    addLog('ERROR', message);
  };

  // Run evaluation
  const runEvaluation = useCallback(async () => {
    if (!mergedData || mergedData.length === 0) return;

    setPhase('EVALUATING');
    setLoading(true, 'ACCESSING DATABASE...');
    addLog('INFO', 'Initiating LLM evaluation protocol...');

    const allResults: any[] = [];
    const batches = [];

    // Create batches
    for (let i = 0; i < mergedData.length; i += BATCH_SIZE) {
      batches.push(mergedData.slice(i, i + BATCH_SIZE));
    }

    addLog('INFO', `Processing ${mergedData.length} records in ${batches.length} batches...`);

    // Process batches
    for (let i = 0; i < batches.length; i++) {
      setLoading(true, `SYSTEM LOADING... BATCH ${i + 1}/${batches.length}`);
      addLog('INFO', `Processing batch ${i + 1}/${batches.length}...`);

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
          addLog('ERROR', `API Error: ${data.error || 'Unknown error'}`);
          throw new Error(data.error || 'Evaluation API failed');
        }

        if (data.results && data.results.length > 0) {
          allResults.push(...data.results);
        } else {
          addLog('WARNING', `Batch ${i + 1} returned no results`);
        }
      } catch (error) {
        addLog('ERROR', `Batch ${i + 1} failed: ${error}`);
      }
    }

    if (allResults.length === 0) {
      addLog('ERROR', 'No results returned from evaluation. Check if OpenAI API key is configured.');
      setLoading(false);
      setPhase('KPI_CONFIG');
      return;
    }

    setEvaluationResults(allResults);
    addLog('SUCCESS', `Evaluation complete. ${allResults.length} records processed.`);

    // Generate summary
    setLoading(true, 'GENERATING EXECUTIVE SUMMARY...');
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
        addLog('SUCCESS', 'Summary generation complete.');
      }
    } catch (error) {
      addLog('WARNING', 'Summary generation failed. Basic statistics available.');
    }

    setLoading(false);
    setPhase('RESULTS');
    addLog('INFO', 'Ready for terminal commands. Type "help" for options.');
  }, [mergedData, kpis, setPhase, setLoading, addLog, setEvaluationResults, setEvaluationSummary]);

  // Handle terminal query (free text to LLM)
  const handleTerminalQuery = useCallback(async (query: string) => {
    if (!evaluationResults || evaluationResults.length === 0) {
      addTerminalEntry('');
      addTerminalEntry('ERROR: No evaluation results available.');
      addTerminalEntry('');
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
        addTerminalEntry('');
        addTerminalEntry(data.response);
        addTerminalEntry('');
      } else {
        addTerminalEntry('');
        addTerminalEntry('ERROR: Failed to process query. Please try again.');
        addTerminalEntry('');
      }
    } catch (error) {
      addTerminalEntry('');
      addTerminalEntry('ERROR: Network error. Please check your connection.');
      addTerminalEntry('');
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
    <div className="min-h-screen p-4 max-w-6xl mx-auto relative">
      {/* Reset Button - Top Right */}
      <button
        onClick={handleReset}
        className="absolute top-4 right-4 dos-button text-xs"
        title="Reset and start over"
      >
        [ RESET ]
      </button>

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

      {/* Main Content */}
      <div className="mt-6 space-y-6">
        {/* Phase: Upload */}
        {currentPhase === 'UPLOAD' && (
          <div className="space-y-6">
            <div className="text-matrix-green mb-4">
              ┌─── DATA UPLOAD INTERFACE ───┐
            </div>

            <div className="text-matrix-green text-sm mb-4">
              Both CSVs must include the MSID column.
            </div>

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
              <div className="text-center mt-6">
                <button onClick={validateAndMergeData} className="dos-button">
                  [ VALIDATE & PROCEED ]
                </button>
              </div>
            )}

            <div className="text-matrix-green/60 text-sm mt-4">
              └─────────────────────────────────────────┘
            </div>
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

        {/* Terminal - Only visible after results are shown (for feedback) */}
        {currentPhase === 'RESULTS' && (
          <div className="mt-8 pt-4 border-t border-matrix-green/30">
            <div className="text-matrix-green/60 text-sm mb-4 text-center">
              ▼ SCROLL DOWN FOR FEEDBACK TERMINAL ▼
            </div>
            <Terminal onCommand={handleTerminalQuery} isProcessing={isTerminalProcessing} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-matrix-green/40 text-xs">
        <div>═══════════════════════════════════════════════════════════</div>
        <div className="mt-2">
          KUALITEE v1.0 | AUTOMATED LLM QA SYSTEM | {new Date().getFullYear()}
        </div>
        <div className="mt-1">
          Optimized for industrial-scale evaluation | Batch Size: {BATCH_SIZE}
        </div>
      </div>
    </div>
  );
}
