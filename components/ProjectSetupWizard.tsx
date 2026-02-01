'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Project, KPI } from '@/lib/types';

interface ProjectSetupWizardProps {
  project: Project;
  onComplete: (updatedProject: Project) => void;
  onCancel: () => void;
}

type WizardStep = 'CONTEXT' | 'KPI_1' | 'KPI_2' | 'KPI_3' | 'KPI_4' | 'COMPLETE';

export default function ProjectSetupWizard({ project, onComplete, onCancel }: ProjectSetupWizardProps) {
  const { addLog } = useAppStore();
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState<WizardStep>('CONTEXT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Project context
  const [projectName, setProjectName] = useState(project.name);
  const [siteDescription, setSiteDescription] = useState(project.siteDescription || '');
  
  // KPIs
  const [kpis, setKpis] = useState<KPI[]>([
    { id: 1, name: '', description: '', shortName: '' },
    { id: 2, name: '', description: '', shortName: '' },
    { id: 3, name: '', description: '', shortName: '' },
    { id: 4, name: '', description: '', shortName: '' },
  ]);

  const getCurrentKPIIndex = (): number => {
    switch (currentStep) {
      case 'KPI_1': return 0;
      case 'KPI_2': return 1;
      case 'KPI_3': return 2;
      case 'KPI_4': return 3;
      default: return -1;
    }
  };

  const currentKPIIndex = getCurrentKPIIndex();
  const currentKPI = currentKPIIndex >= 0 ? kpis[currentKPIIndex] : null;
  
  // Count configured KPIs
  const configuredKPICount = kpis.filter(k => k.name.trim() && k.description.trim()).length;

  const updateKPI = (index: number, field: keyof KPI, value: string) => {
    setKpis(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-generate short name
      if (field === 'description' && value.length > 0) {
        const words = value.split(' ').filter(w => w.length > 3);
        updated[index].shortName = words[0]?.toUpperCase().slice(0, 10) || `KPI${index + 1}`;
      }
      return updated;
    });
    if (error) setError(null);
  };

  const handleContextNext = () => {
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }
    if (!siteDescription.trim()) {
      setError('Site description is required for accurate LLM evaluation');
      return;
    }
    setError(null);
    setCurrentStep('KPI_1');
  };

  const handleKPIConfirm = () => {
    if (!currentKPI) return;
    
    if (!currentKPI.name.trim()) {
      setError('KPI name is required');
      return;
    }
    if (!currentKPI.description.trim()) {
      setError('KPI description (Good vs Bad) is required');
      return;
    }
    
    setError(null);
    
    // Move to next step
    switch (currentStep) {
      case 'KPI_1': setCurrentStep('KPI_2'); break;
      case 'KPI_2': setCurrentStep('KPI_3'); break;
      case 'KPI_3': setCurrentStep('KPI_4'); break;
      case 'KPI_4': handleComplete(); break;
    }
  };

  const handleSkipRemaining = () => {
    // Only allow skip if at least 1 KPI is configured
    if (configuredKPICount === 0) {
      setError('You must configure at least 1 KPI before skipping');
      return;
    }
    handleComplete();
  };

  const handleComplete = async () => {
    const validKPIs = kpis.filter(k => k.name.trim() && k.description.trim());
    
    if (validKPIs.length === 0) {
      setError('You must configure at least 1 KPI');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          siteDescription: siteDescription.trim(),
          kpis: validKPIs.map(k => ({
            name: k.name,
            description: k.description,
            shortName: k.shortName || k.name.slice(0, 10).toUpperCase(),
          })),
          markAsConfigured: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save project configuration');
      }

      const data = await response.json();
      addLog('SUCCESS', `Project "${projectName}" configured with ${validKPIs.length} KPI(s)`);
      onComplete(data.project);
    } catch (err) {
      console.error('Error saving project:', err);
      setError('Failed to save project configuration. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepNumber = (): number => {
    switch (currentStep) {
      case 'CONTEXT': return 1;
      case 'KPI_1': return 2;
      case 'KPI_2': return 3;
      case 'KPI_3': return 4;
      case 'KPI_4': return 5;
      default: return 1;
    }
  };

  const getStepTitle = (): string => {
    switch (currentStep) {
      case 'CONTEXT': return 'Project Settings';
      case 'KPI_1': return 'Define KPI #1';
      case 'KPI_2': return 'Define KPI #2';
      case 'KPI_3': return 'Define KPI #3';
      case 'KPI_4': return 'Define KPI #4';
      default: return 'Setup';
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {getStepTitle()}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Step {getStepNumber()} of 5</p>
          </div>
          <button 
            onClick={onCancel} 
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Progress Indicator */}
        <div className="progress-steps mb-8">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`progress-step ${
                  step < getStepNumber()
                    ? 'completed'
                    : step === getStepNumber()
                    ? 'active'
                    : 'pending'
                }`}
              >
                {step < getStepNumber() ? '✓' : step}
              </div>
              {step < 5 && (
                <div className={`progress-connector ${step < getStepNumber() ? 'completed' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Project Context */}
        {currentStep === 'CONTEXT' && (
          <div className="space-y-6">
            <p className="text-slate-600">
              Tell us about your project so the LLM can provide more accurate evaluations.
            </p>

            <div className="space-y-5">
              <div>
                <label className="input-label">Project Name *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Customer Support Bot Evaluation"
                  className="input-field"
                />
              </div>

              <div>
                <label className="input-label">Prompt / Agent Context *</label>
                <p className="text-sm text-slate-500 mb-2">
                  Describe what your LLM prompt or AI agent is designed to do, its goal, and a summary of the logic. This context helps evaluate outputs more accurately.
                </p>
                <textarea
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="e.g., A customer support chatbot that answers questions about software subscriptions. It should be helpful, accurate, and guide users to solutions. The agent retrieves FAQ data and generates contextual responses."
                  className="input-field resize-none"
                  rows={4}
                />
              </div>
            </div>

            {error && (
              <div className="badge badge-error w-full justify-center py-3">
                ⚠️ {error}
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={onCancel} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleContextNext} className="btn-primary">
                Next: Define KPIs →
              </button>
            </div>
          </div>
        )}

        {/* Steps: KPI Configuration */}
        {currentKPI && (
          <div className="space-y-6">
            <p className="text-slate-600">
              Define Key Performance Indicators for evaluation. Describe what constitutes "Good" vs "Bad" for each metric.
              <br />
              <span className="font-semibold text-slate-800">Minimum 1 KPI required.</span> You can configure up to 4.
            </p>

            <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 text-sm font-medium">
              KPI {currentKPIIndex + 1} of 4 
              {configuredKPICount > 0 && ` (${configuredKPICount} configured)`}
            </div>

            <div className="bg-slate-50 rounded-xl p-5 space-y-4 border border-slate-100">
              <div className="text-sm font-semibold text-slate-800">
                KPI #{currentKPIIndex + 1} {currentKPI.shortName && <span className="text-purple-600">[{currentKPI.shortName}]</span>}
              </div>

              <div>
                <label className="input-label">KPI Name *</label>
                <input
                  type="text"
                  value={currentKPI.name}
                  onChange={(e) => updateKPI(currentKPIIndex, 'name', e.target.value)}
                  placeholder="e.g., Accuracy, Relevance, Tone, Completeness..."
                  className="input-field"
                />
              </div>

              <div>
                <label className="input-label">Description (Good vs Bad) *</label>
                <textarea
                  value={currentKPI.description}
                  onChange={(e) => updateKPI(currentKPIIndex, 'description', e.target.value)}
                  placeholder="e.g., Good: Response directly answers the question with factual accuracy. Bad: Response contains incorrect information or misses the point entirely."
                  className="input-field resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Previously configured KPIs */}
            {currentKPIIndex > 0 && configuredKPICount > 0 && (
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">Configured:</span>{' '}
                {kpis.slice(0, currentKPIIndex).filter(k => k.name.trim()).map(k => k.shortName || k.name).join(', ')}
              </p>
            )}

            {error && (
              <div className="badge badge-error w-full justify-center py-3">
                ⚠️ {error}
              </div>
            )}

            <div className="flex justify-between gap-3 pt-4">
              <button
                onClick={() => {
                  const prevSteps: WizardStep[] = ['CONTEXT', 'KPI_1', 'KPI_2', 'KPI_3'];
                  setCurrentStep(prevSteps[getStepNumber() - 2] || 'CONTEXT');
                }}
                className="btn-secondary"
              >
                ← Back
              </button>
              
              <div className="flex gap-3">
                {/* Skip button - only show after KPI_1 if at least 1 is configured */}
                {currentStep !== 'KPI_1' && configuredKPICount >= 1 && (
                  <button
                    onClick={handleSkipRemaining}
                    className="btn-secondary"
                    disabled={isSubmitting}
                  >
                    Skip & Finish
                  </button>
                )}
                
                <button
                  onClick={handleKPIConfirm}
                  className="btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Saving...'
                    : currentStep === 'KPI_4'
                    ? 'Confirm & Finish Setup'
                    : 'Confirm & Continue →'
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
