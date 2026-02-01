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

const LANGUAGE_OPTIONS = [
  'English (US)',
  'English (UK)',
  'Spanish (Spain)',
  'Spanish (Mexico)',
  'French (France)',
  'German (Germany)',
  'Portuguese (Brazil)',
  'Italian (Italy)',
  'Dutch (Netherlands)',
  'Japanese',
  'Korean',
  'Chinese (Simplified)',
  'Chinese (Traditional)',
  'Arabic',
  'Hebrew',
  'Russian',
  'Other',
];

export default function ProjectSetupWizard({ project, onComplete, onCancel }: ProjectSetupWizardProps) {
  const { addLog } = useAppStore();
  
  // Step tracking
  const [currentStep, setCurrentStep] = useState<WizardStep>('CONTEXT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Project context
  const [projectName, setProjectName] = useState(project.name);
  const [siteDescription, setSiteDescription] = useState(project.siteDescription || '');
  const [targetLanguage, setTargetLanguage] = useState(project.targetLanguage || 'English (US)');
  
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
          targetLanguage,
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
    <div className="terminal-window overflow-hidden">
      <div className="title-bar">
        <span>🚀 Project Setup Wizard - {getStepTitle()}</span>
        <div className="title-bar-controls">
          <button className="title-bar-btn" onClick={onCancel} title="Cancel">×</button>
        </div>
      </div>

      <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step < getStepNumber()
                    ? 'bg-green-500 text-white'
                    : step === getStepNumber()
                    ? 'bg-title-bar text-white'
                    : 'bg-gray-300 text-gray-500'
                }`}
              >
                {step < getStepNumber() ? '✓' : step}
              </div>
              {step < 5 && (
                <div className={`w-8 h-1 ${step < getStepNumber() ? 'bg-green-500' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step: Project Context */}
        {currentStep === 'CONTEXT' && (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary mb-4">
              Tell us about your project so the LLM can provide more accurate evaluations.
            </div>

            <div className="terminal-output p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., Customer Support Bot Evaluation"
                  className="text-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">
                  Site / Product Description *
                </label>
                <p className="text-xs text-text-secondary mb-2">
                  Describe your site, product, or the context being evaluated. This helps the LLM understand the niche and provide relevant scores.
                </p>
                <textarea
                  value={siteDescription}
                  onChange={(e) => setSiteDescription(e.target.value)}
                  placeholder="e.g., An e-commerce platform selling outdoor camping gear. Target audience is adventure enthusiasts aged 25-45. The tone should be helpful and knowledgeable about outdoor activities."
                  className="text-input w-full resize-none"
                  rows={4}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">
                  Target Language & Dialect
                </label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value)}
                  className="text-input w-full"
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="text-sm p-2 rounded" style={{ backgroundColor: '#FEE2E2', color: '#CC0000' }}>
                ⚠️ {error}
              </div>
            )}

            <div className="flex justify-between">
              <button onClick={onCancel} className="send-btn" style={{ backgroundColor: '#808080' }}>
                Cancel
              </button>
              <button onClick={handleContextNext} className="send-btn">
                Next: Define KPIs →
              </button>
            </div>
          </div>
        )}

        {/* Steps: KPI Configuration */}
        {currentKPI && (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary mb-4">
              Define Key Performance Indicators for evaluation. Describe what constitutes &quot;Good&quot; vs &quot;Bad&quot; for each metric.
              <br />
              <span className="font-semibold">Minimum 1 KPI required.</span> You can configure up to 4.
            </div>

            <div className="suggestion-chip inline-block mb-4">
              KPI {currentKPIIndex + 1} of 4 
              {configuredKPICount > 0 && ` (${configuredKPICount} configured)`}
            </div>

            <div className="terminal-output p-4 space-y-3">
              <div className="text-sm font-semibold text-text-primary">
                KPI #{currentKPIIndex + 1} {currentKPI.shortName && `[${currentKPI.shortName}]`}
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  KPI Name *
                </label>
                <input
                  type="text"
                  value={currentKPI.name}
                  onChange={(e) => updateKPI(currentKPIIndex, 'name', e.target.value)}
                  placeholder="e.g., Accuracy, Relevance, Tone, Completeness..."
                  className="text-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Description (Good vs Bad) *
                </label>
                <textarea
                  value={currentKPI.description}
                  onChange={(e) => updateKPI(currentKPIIndex, 'description', e.target.value)}
                  placeholder="e.g., Good: Response directly answers the question with factual accuracy. Bad: Response contains incorrect information or misses the point entirely."
                  className="text-input w-full resize-none"
                  rows={3}
                />
              </div>
            </div>

            {/* Previously configured KPIs */}
            {currentKPIIndex > 0 && configuredKPICount > 0 && (
              <div className="text-xs text-text-secondary">
                <span className="font-semibold">Configured:</span>{' '}
                {kpis.slice(0, currentKPIIndex).filter(k => k.name.trim()).map(k => k.shortName || k.name).join(', ')}
              </div>
            )}

            {error && (
              <div className="text-sm p-2 rounded" style={{ backgroundColor: '#FEE2E2', color: '#CC0000' }}>
                ⚠️ {error}
              </div>
            )}

            <div className="flex justify-between gap-3">
              <button
                onClick={() => {
                  const prevSteps: WizardStep[] = ['CONTEXT', 'KPI_1', 'KPI_2', 'KPI_3'];
                  setCurrentStep(prevSteps[getStepNumber() - 2] || 'CONTEXT');
                }}
                className="send-btn"
                style={{ backgroundColor: '#808080' }}
              >
                ← Back
              </button>
              
              <div className="flex gap-3">
                {/* Skip button - only show after KPI_1 if at least 1 is configured */}
                {currentStep !== 'KPI_1' && configuredKPICount >= 1 && (
                  <button
                    onClick={handleSkipRemaining}
                    className="send-btn"
                    style={{ backgroundColor: '#808080' }}
                    disabled={isSubmitting}
                  >
                    Skip & Finish
                  </button>
                )}
                
                <button
                  onClick={handleKPIConfirm}
                  className="send-btn"
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
