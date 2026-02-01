'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';

interface KPIConfigProps {
  onComplete: () => void;
}

export default function KPIConfig({ onComplete }: KPIConfigProps) {
  const { kpis, updateKPI, addLog, setKPIs, currentProject } = useAppStore();
  const [currentKPIIndex, setCurrentKPIIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const currentKPI = kpis[currentKPIIndex];
  const isFirstKPI = currentKPIIndex === 0;
  const isLastKPI = currentKPIIndex === 3;

  // Check if KPIs are pre-filled from project
  const prefilledKPIs = useMemo(() => {
    return kpis.filter(k => k.name.trim() && k.description.trim());
  }, [kpis]);
  
  const hasPrefilledKPIs = prefilledKPIs.length > 0 && currentProject;

  // Quick confirm all pre-filled KPIs
  const handleUseProjectKPIs = () => {
    if (prefilledKPIs.length === 0) {
      setError('No KPIs configured for this project');
      return;
    }
    
    setIsCompleting(true);
    setKPIs(prefilledKPIs);
    addLog('SUCCESS', `Using ${prefilledKPIs.length} project KPI(s)`);
    onComplete();
  };

  // Guard: if we're in completing state or currentKPI doesn't exist, don't render
  if (isCompleting || !currentKPI) {
    return (
      <div className="card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-lg font-semibold text-white">KPI Configuration</h2>
        </div>
        <div className="p-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <svg className="w-6 h-6 animate-spin text-purple-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-600 font-medium">Starting evaluation...</p>
          </div>
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
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
        <h2 className="text-lg font-semibold text-white">KPI Configuration</h2>
        <p className="text-sm text-white/70">Step {currentKPIIndex + 1} of 4</p>
      </div>

      <div className="p-6">
        {/* Pre-filled KPIs from Project - Quick Confirm */}
        {hasPrefilledKPIs && currentKPIIndex === 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Project KPIs Available</h3>
                <p className="text-sm text-slate-600">
                  This project has {prefilledKPIs.length} KPI(s) configured. You can use them directly or customize below.
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {prefilledKPIs.map((kpi) => (
                <div key={kpi.id} className="inline-flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-purple-200">
                  <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                    {kpi.shortName}
                  </span>
                  <span className="text-sm text-slate-700">{kpi.name}</span>
                </div>
              ))}
            </div>
            
            <button onClick={handleUseProjectKPIs} className="btn-primary w-full">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Use Project KPIs & Start Evaluation
            </button>
            <p className="text-xs text-slate-500 mt-3 text-center">
              Or customize KPIs below
            </p>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Progress</span>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
              KPI {currentKPIIndex + 1} of 4
              {configuredCount > 0 && ` • ${configuredCount} configured`}
            </span>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  idx < currentKPIIndex
                    ? 'bg-green-500'
                    : idx === currentKPIIndex
                    ? 'bg-purple-600'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* KPI Form */}
        <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm font-semibold text-slate-800">KPI #{currentKPI.id}</span>
            {currentKPI.shortName && (
              <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                {currentKPI.shortName}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="input-label">KPI Name *</label>
              <input
                type="text"
                value={currentKPI.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Accuracy, Relevance, Tone, Completeness..."
                className="input-field"
              />
            </div>

            <div>
              <label className="input-label">Description (Good vs Bad) *</label>
              <textarea
                value={currentKPI.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="e.g., Good: Response directly answers the question with factual accuracy. Bad: Response contains incorrect information or misses the point entirely."
                rows={3}
                className="input-field resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-3">
          <button onClick={handleConfirm} className="btn-primary">
            {isLastKPI ? 'Confirm & Start Evaluation' : 'Confirm & Continue'}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          {!isFirstKPI && (
            <button onClick={handleSkip} className="btn-secondary">
              Skip & Start Evaluation
            </button>
          )}
        </div>

        {/* Previously configured KPIs */}
        {currentKPIIndex > 0 && configuredCount > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-600 mb-3">Configured KPIs:</p>
            <div className="flex flex-wrap gap-2">
              {kpis.slice(0, currentKPIIndex).map((kpi) => (
                kpi.name.trim() && (
                  <div key={kpi.id} className="inline-flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-700">{kpi.name}</span>
                    <span className="text-xs text-green-600 font-medium">[{kpi.shortName}]</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
