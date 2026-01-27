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
  const [isCompleting, setIsCompleting] = useState(false);

  const currentKPI = kpis[currentKPIIndex];
  const isFirstKPI = currentKPIIndex === 0;
  const isLastKPI = currentKPIIndex === 3;

  // Guard: if we're in completing state or currentKPI doesn't exist, don't render
  if (isCompleting || !currentKPI) {
    return (
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>⚙️ KPI Configuration</span>
        </div>
        <div className="p-5 text-center" style={{ backgroundColor: '#e6e0d4' }}>
          <p className="text-text-primary">Starting evaluation...</p>
        </div>
      </div>
    );
  }

  const handleNameChange = (name: string) => {
    updateKPI(currentKPI.id, { name });
    if (error) setError(null);
  };

  const handleDescriptionChange = (description: string) => {
    updateKPI(currentKPI.id, { description });
    
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
      // Set completing state FIRST to prevent re-render issues
      setIsCompleting(true);
      
      const configuredKPIs = kpis.filter(
        kpi => kpi.name.trim() && kpi.description.trim()
      );
      setKPIs(configuredKPIs);
      addLog('SUCCESS', `KPI configuration completed with ${configuredKPIs.length} KPI(s)`);
      onComplete();
    } else {
      setCurrentKPIIndex(currentKPIIndex + 1);
      setError(null);
    }
  };

  const handleSkip = () => {
    const configuredKPIs = kpis.slice(0, currentKPIIndex).filter(
      kpi => kpi.name.trim() && kpi.description.trim()
    );

    if (configuredKPIs.length === 0) {
      setError('You need at least 1 KPI to proceed');
      return;
    }

    // Set completing state FIRST to prevent re-render issues
    setIsCompleting(true);
    
    setKPIs(configuredKPIs);
    addLog('SUCCESS', `KPI configuration completed with ${configuredKPIs.length} KPI(s)`);
    onComplete();
  };

  const configuredCount = kpis.slice(0, currentKPIIndex).filter(
    kpi => kpi.name.trim() && kpi.description.trim()
  ).length;

  return (
    <div className="terminal-window overflow-hidden">
      <div className="title-bar">
        <span>⚙️ KPI Configuration</span>
        <div className="title-bar-controls">
          <button className="title-bar-btn">─</button>
          <button className="title-bar-btn">□</button>
          <button className="title-bar-btn">×</button>
        </div>
      </div>

      <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
        <div className="text-sm text-text-secondary mb-4">
          Define Key Performance Indicators for evaluation.
          <br />
          Describe what constitutes "Good" vs "Bad" for each metric.
          <br />
          Scoring: 1 (Critical Failure) to 5 (Optimal)
        </div>

        <div className="suggestion-chip inline-block mb-4">
          Progress: KPI {currentKPIIndex + 1} of 4 
          {configuredCount > 0 && ` (${configuredCount} configured)`}
        </div>

        <div className="terminal-output p-4 mb-4">
          <div className="text-sm font-semibold text-text-primary mb-3">
            KPI #{currentKPI.id} {currentKPI.shortName && `[${currentKPI.shortName}]`}
          </div>

          <div className="mb-3">
            <label className="block text-sm text-text-secondary mb-1">
              Name:
            </label>
            <input
              type="text"
              value={currentKPI.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Accuracy, Relevance, Tone..."
              className="text-input w-full"
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm text-text-secondary mb-1">
              Description (Define Good vs Bad):
            </label>
            <textarea
              value={currentKPI.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="e.g., Good: Response directly answers the question with factual accuracy. Bad: Response contains incorrect information or misses the point entirely."
              rows={3}
              className="text-input w-full resize-none"
            />
          </div>

          {error && (
            <div className="text-sm mt-2" style={{ color: '#CC0000' }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-3">
          <button onClick={handleConfirm} className="send-btn">
            {isLastKPI ? 'Confirm & Start Evaluation' : 'Confirm KPI & Continue'}
          </button>
          
          {!isFirstKPI && (
            <button onClick={handleSkip} className="send-btn" style={{ backgroundColor: '#808080' }}>
              Skip Remaining & Start
            </button>
          )}
        </div>

        {currentKPIIndex > 0 && (
          <div className="mt-4 pt-4 border-t border-border-gray">
            <div className="text-sm text-text-secondary mb-2">
              Configured KPIs:
            </div>
            {kpis.slice(0, currentKPIIndex).map((kpi) => (
              kpi.name.trim() && (
                <div key={kpi.id} className="text-sm text-text-primary ml-2">
                  • KPI {kpi.id}: {kpi.name} [{kpi.shortName}]
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
