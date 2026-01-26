'use client';

import { useState, useCallback } from 'react';
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
    updateKPI,
    updateEvaluationResult,
  } = useAppStore();

  const [showFailuresOnly, setShowFailuresOnly] = useState(false);

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

        if (!response.ok) {
          throw new Error('Evaluation API failed');
        }

        const data = await response.json();
        allResults.push(...data.results);
      } catch (error) {
        addLog('ERROR', `Batch ${i + 1} failed: ${error}`);
      }
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

  // Handle terminal commands
  const handleTerminalCommand = useCallback(async (command: string) => {
    const cmd = command.toLowerCase().trim();

    if (cmd === 'help') {
      addTerminalEntry('');
      addTerminalEntry('AVAILABLE COMMANDS:');
      addTerminalEntry('───────────────────────────────────────');
      addTerminalEntry('  help                    - Show this help message');
      addTerminalEntry('  status                  - Show current system status');
      addTerminalEntry('  drill down on failures  - Filter to show only scores < 3');
      addTerminalEntry('  show all                - Show all results');
      addTerminalEntry('  re-configure kpi [N]    - Update KPI N configuration');
      addTerminalEntry('  re-evaluate msid [X]    - Re-evaluate specific MSID');
      addTerminalEntry('  clear                   - Clear terminal history');
      addTerminalEntry('  restart                 - Reset and start over');
      addTerminalEntry('');
      return;
    }

    if (cmd === 'status') {
      addTerminalEntry('');
      addTerminalEntry(`PHASE: ${currentPhase}`);
      addTerminalEntry(`SOURCE RECORDS: ${sourceData?.length || 0}`);
      addTerminalEntry(`TARGET RECORDS: ${targetData?.length || 0}`);
      addTerminalEntry(`EVALUATED: ${evaluationResults?.length || 0}`);
      addTerminalEntry('');
      return;
    }

    if (cmd === 'drill down on failures' || cmd === 'show failures') {
      setShowFailuresOnly(true);
      addTerminalEntry('');
      addTerminalEntry('FILTER APPLIED: Showing records with scores < 3');
      addTerminalEntry('');
      return;
    }

    if (cmd === 'show all') {
      setShowFailuresOnly(false);
      addTerminalEntry('');
      addTerminalEntry('FILTER REMOVED: Showing all records');
      addTerminalEntry('');
      return;
    }

    if (cmd === 'clear') {
      useAppStore.getState().clearTerminal();
      return;
    }

    if (cmd === 'restart') {
      useAppStore.getState().clearData();
      setPhase('UPLOAD');
      addTerminalEntry('');
      addTerminalEntry('SYSTEM RESET. Ready for new data upload.');
      addTerminalEntry('');
      return;
    }

    // Re-configure KPI
    const reconfigMatch = cmd.match(/re-?configure\s+kpi\s+(\d+)/i);
    if (reconfigMatch) {
      const kpiId = parseInt(reconfigMatch[1]);
      if (kpiId >= 1 && kpiId <= 4) {
        addTerminalEntry('');
        addTerminalEntry(`Enter new description for KPI ${kpiId}:`);
        addTerminalEntry('(Feature: Use the KPI config panel to update)');
        addTerminalEntry('');
        // In a full implementation, this would open a modal or inline editor
      } else {
        addTerminalEntry('');
        addTerminalEntry('ERROR: KPI ID must be between 1 and 4');
        addTerminalEntry('');
      }
      return;
    }

    // Re-evaluate MSID
    const reevalMatch = cmd.match(/re-?evaluate\s+msid\s+(.+)/i);
    if (reevalMatch) {
      const msid = reevalMatch[1].trim();
      const record = mergedData?.find((m) => m.source.MSID === msid);
      
      if (!record) {
        addTerminalEntry('');
        addTerminalEntry(`ERROR: MSID "${msid}" not found in dataset`);
        addTerminalEntry('');
        return;
      }

      addTerminalEntry('');
      addTerminalEntry(`RE-EVALUATING MSID: ${msid}...`);
      
      try {
        const response = await fetch('/api/evaluate', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: record.source,
            target: record.target,
            kpis,
            msid,
            userFeedback: 'User requested re-evaluation. Please review more carefully.',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          updateEvaluationResult(msid, result);
          addTerminalEntry(`RE-EVALUATION COMPLETE for MSID: ${msid}`);
          addLog('SUCCESS', `MSID ${msid} re-evaluated`);
        } else {
          addTerminalEntry('ERROR: Re-evaluation failed');
        }
      } catch (error) {
        addTerminalEntry('ERROR: Network error during re-evaluation');
      }
      addTerminalEntry('');
      return;
    }

    // Handle "I made a mistake in KPI X"
    const mistakeMatch = cmd.match(/mistake.*kpi\s*(\d+)/i);
    if (mistakeMatch) {
      const kpiId = parseInt(mistakeMatch[1]);
      addTerminalEntry('');
      addTerminalEntry(`Acknowledged. Please update KPI ${kpiId} in the configuration panel.`);
      addTerminalEntry('After updating, type "re-run kpi [N]" to re-evaluate.');
      addTerminalEntry('');
      return;
    }

    // Handle "You are wrong about MSID [X]"
    const wrongMatch = cmd.match(/wrong.*msid\s*\[?([^\]]+)\]?/i);
    if (wrongMatch) {
      const msid = wrongMatch[1].trim();
      addTerminalEntry('');
      addTerminalEntry(`Acknowledged. Queuing MSID ${msid} for re-evaluation with your feedback.`);
      addTerminalEntry(`Run: re-evaluate msid ${msid}`);
      addTerminalEntry('');
      return;
    }

    // Unknown command
    addTerminalEntry('');
    addTerminalEntry(`UNKNOWN COMMAND: ${command}`);
    addTerminalEntry('Type "help" for available commands.');
    addTerminalEntry('');
  }, [currentPhase, sourceData, targetData, evaluationResults, mergedData, kpis, setPhase, addTerminalEntry, addLog, updateEvaluationResult]);

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
          <div className="mt-8">
            <Terminal onCommand={handleTerminalCommand} />
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
