'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

interface KPIConfigProps {
  onComplete: () => void;
}

export default function KPIConfig({ onComplete }: KPIConfigProps) {
  const { kpis, updateKPI, addLog, setKPIs } = useAppStore();
  const [currentKPIIndex, setCurrentKPIIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const currentKPI = kpis[currentKPIIndex];
  const isFirstKPI = currentKPIIndex === 0;
  const isLastKPI = currentKPIIndex === 3;

  const handleNameChange = (name: string) => {
    updateKPI(currentKPI.id, { name });
    if (error) setError(null);
  };

  const handleDescriptionChange = (description: string) => {
    updateKPI(currentKPI.id, { description });
    
    // Auto-generate short name from description
    if (description.length > 0) {
      const words = description.split(' ').filter(w => w.length > 3);
      const shortName = words[0]?.toUpperCase().slice(0, 10) || 'KPI' + currentKPI.id;
      updateKPI(currentKPI.id, { shortName });
    }
    if (error) setError(null);
  };

  const validateCurrentKPI = (): boolean => {
    if (!currentKPI.name.trim()) {
      setError('KPI name is required');
      return false;
    }
    if (!currentKPI.description.trim()) {
      setError('Description defining Good vs Bad is required');
      return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (!validateCurrentKPI()) return;

    addLog('INFO', `KPI ${currentKPI.id}: ${currentKPI.name} [${currentKPI.shortName}] configured`);

    if (isLastKPI) {
      // All KPIs configured, proceed to evaluation
      finishConfiguration();
    } else {
      // Move to next KPI
      setCurrentKPIIndex(currentKPIIndex + 1);
      setError(null);
    }
  };

  const handleSkip = () => {
    // Clear the current KPI and all remaining KPIs
    const configuredKPIs = kpis.slice(0, currentKPIIndex).filter(
      kpi => kpi.name.trim() && kpi.description.trim()
    );

    if (configuredKPIs.length === 0) {
      setError('You need at least 1 KPI to proceed');
      return;
    }

    // Update the store to only keep configured KPIs
    setKPIs(configuredKPIs);
    
    addLog('INFO', `Skipping remaining KPIs. Using ${configuredKPIs.length} KPI(s)`);
    finishConfiguration();
  };

  const finishConfiguration = () => {
    const configuredKPIs = kpis.filter(
      kpi => kpi.name.trim() && kpi.description.trim()
    );
    
    addLog('SUCCESS', `KPI configuration completed with ${configuredKPIs.length} KPI(s)`);
    onComplete();
  };

  // Get count of configured KPIs so far
  const configuredCount = kpis.slice(0, currentKPIIndex).filter(
    kpi => kpi.name.trim() && kpi.description.trim()
  ).length;

  return (
    <div className="border border-matrix-green p-6">
      <div className="text-matrix-green text-lg mb-4">
        ╔═══════════════════════════════════════╗
        <br />
        ║&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;KPI CONFIGURATION&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;║
        <br />
        ╚═══════════════════════════════════════╝
      </div>

      <div className="text-matrix-green/60 text-sm mb-6">
        Define Key Performance Indicators for evaluation.
        <br />
        Describe what constitutes &quot;Good&quot; vs &quot;Bad&quot; for each metric.
        <br />
        Scoring: 1 (Critical Failure) to 5 (Optimal)
        <br />
        <br />
        <span className="text-warning-amber">
          Progress: KPI {currentKPIIndex + 1} of 4 {configuredCount > 0 && `(${configuredCount} configured)`}
        </span>
      </div>

      <div className="border border-matrix-green/50 p-4">
        <div className="text-warning-amber mb-3">
          ┌─ KPI #{currentKPI.id} {currentKPI.shortName && `[${currentKPI.shortName}]`} ─┐
        </div>

        <div className="mb-3">
          <label className="block text-matrix-green/80 text-sm mb-1">
            NAME:
          </label>
          <input
            type="text"
            value={currentKPI.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g., Accuracy, Relevance, Tone..."
            className="w-full"
          />
        </div>

        <div className="mb-2">
          <label className="block text-matrix-green/80 text-sm mb-1">
            DESCRIPTION (Define Good vs Bad):
          </label>
          <textarea
            value={currentKPI.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="e.g., Good: Response directly answers the question with factual accuracy. Bad: Response contains incorrect information or misses the point entirely."
            rows={3}
            className="w-full resize-none"
          />
        </div>

        {error && (
          <div className="text-error-red text-sm">
            ⚠ {error}
          </div>
        )}

        <div className="text-matrix-green/40 text-xs">
          └────────────────────────────────────────┘
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-4">
        <button onClick={handleConfirm} className="dos-button">
          {isLastKPI ? '[ CONFIRM & START EVALUATION ]' : '[ CONFIRM KPI & CONTINUE ]'}
        </button>
        
        {!isFirstKPI && (
          <button onClick={handleSkip} className="dos-button">
            [ SKIP REMAINING & START ]
          </button>
        )}
      </div>

      {/* Show already configured KPIs */}
      {currentKPIIndex > 0 && (
        <div className="mt-6 border-t border-matrix-green/30 pt-4">
          <div className="text-matrix-green/60 text-sm mb-2">
            ┌─ CONFIGURED KPIs ─┐
          </div>
          {kpis.slice(0, currentKPIIndex).map((kpi) => (
            kpi.name.trim() && (
              <div key={kpi.id} className="text-matrix-green/70 text-sm ml-2">
                • KPI {kpi.id}: {kpi.name} [{kpi.shortName}]
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
