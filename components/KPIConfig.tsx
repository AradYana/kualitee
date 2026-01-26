'use client';

import { useState } from 'react';
import { KPI } from '@/lib/types';
import { useAppStore } from '@/lib/store';

interface KPIConfigProps {
  onComplete: () => void;
}

export default function KPIConfig({ onComplete }: KPIConfigProps) {
  const { kpis, updateKPI, addLog } = useAppStore();
  const [errors, setErrors] = useState<Record<number, string>>({});

  const handleNameChange = (id: number, name: string) => {
    updateKPI(id, { name });
    if (errors[id]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[id];
        return newErrors;
      });
    }
  };

  const handleDescriptionChange = (id: number, description: string) => {
    updateKPI(id, { description });
    
    // Auto-generate short name from description
    if (description.length > 0) {
      const words = description.split(' ').filter(w => w.length > 3);
      const shortName = words[0]?.toUpperCase().slice(0, 10) || 'KPI' + id;
      updateKPI(id, { shortName });
    }
  };

  const validateAndSubmit = () => {
    const newErrors: Record<number, string> = {};
    
    kpis.forEach((kpi) => {
      if (!kpi.name.trim()) {
        newErrors[kpi.id] = 'KPI name is required';
      } else if (!kpi.description.trim()) {
        newErrors[kpi.id] = 'Description defining Good vs Bad is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    addLog('SUCCESS', 'KPI configuration completed');
    kpis.forEach((kpi) => {
      addLog('INFO', `KPI ${kpi.id}: ${kpi.name} [${kpi.shortName}]`);
    });
    
    onComplete();
  };

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
        Define 4 Key Performance Indicators for evaluation.
        <br />
        Describe what constitutes &quot;Good&quot; vs &quot;Bad&quot; for each metric.
        <br />
        Scoring: 1 (Critical Failure) to 5 (Optimal)
      </div>

      <div className="space-y-6">
        {kpis.map((kpi) => (
          <div key={kpi.id} className="border border-matrix-green/50 p-4">
            <div className="text-warning-amber mb-3">
              ┌─ KPI #{kpi.id} {kpi.shortName && `[${kpi.shortName}]`} ─┐
            </div>

            <div className="mb-3">
              <label className="block text-matrix-green/80 text-sm mb-1">
                NAME:
              </label>
              <input
                type="text"
                value={kpi.name}
                onChange={(e) => handleNameChange(kpi.id, e.target.value)}
                placeholder="e.g., Accuracy, Relevance, Tone..."
                className="w-full"
              />
            </div>

            <div className="mb-2">
              <label className="block text-matrix-green/80 text-sm mb-1">
                DESCRIPTION (Define Good vs Bad):
              </label>
              <textarea
                value={kpi.description}
                onChange={(e) => handleDescriptionChange(kpi.id, e.target.value)}
                placeholder="e.g., Good: Response directly answers the question with factual accuracy. Bad: Response contains incorrect information or misses the point entirely."
                rows={3}
                className="w-full resize-none"
              />
            </div>

            {errors[kpi.id] && (
              <div className="text-error-red text-sm">
                ⚠ {errors[kpi.id]}
              </div>
            )}

            <div className="text-matrix-green/40 text-xs">
              └────────────────────────────────────────┘
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button onClick={validateAndSubmit} className="dos-button">
          [ CONFIRM KPI CONFIGURATION ]
        </button>
      </div>
    </div>
  );
}
