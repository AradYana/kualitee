'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Project, TestSet, KPI } from '@/lib/types';
import ProjectSetupWizard from './ProjectSetupWizard';

interface ProjectDetail extends Project {
  testSets: TestSet[];
}

export default function ProjectHub() {
  const { 
    currentProject, 
    goToProjects, 
    startNewTest, 
    setCurrentProject,
    setScreen,
    setCurrentTestSet,
    addLog 
  } = useAppStore();
  
  const [projectDetail, setProjectDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingKPIs, setIsEditingKPIs] = useState(false);
  const [editedKPIs, setEditedKPIs] = useState<KPI[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  
  // Edit Settings state (name & description only)
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  
  // Determine if project needs setup (no KPIs configured)
  const needsSetup = projectDetail && (!projectDetail.isConfigured || !projectDetail.kpis || projectDetail.kpis.length === 0);

  // Fetch project details on mount
  useEffect(() => {
    if (currentProject?.id) {
      fetchProjectDetail();
    }
  }, [currentProject?.id]);

  const fetchProjectDetail = async () => {
    if (!currentProject?.id) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      const data = await res.json();
      setProjectDetail(data.project);
      
      // Initialize edited name and description
      setEditedName(data.project.name || '');
      setEditedDescription(data.project.siteDescription || '');
      
      // Initialize edited KPIs
      if (data.project.kpis) {
        const kpis = data.project.kpis.map((k: any) => ({
          id: k.kpiNumber,
          name: k.name,
          description: k.description,
          shortName: k.shortName,
        }));
        // Pad to 4 KPIs
        while (kpis.length < 4) {
          kpis.push({ id: kpis.length + 1, name: '', description: '', shortName: '' });
        }
        setEditedKPIs(kpis);
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!currentProject?.id) return;
    
    if (!editedName.trim()) {
      setError('Project name is required');
      return;
    }
    if (!editedDescription.trim()) {
      setError('Prompt/Agent context is required');
      return;
    }
    
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedName.trim(),
          siteDescription: editedDescription.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to update settings');
      
      addLog('SUCCESS', 'Project settings updated');
      setIsEditingSettings(false);
      setError(null);
      await fetchProjectDetail();
      // Update the current project in store
      setCurrentProject({ ...currentProject, name: editedName.trim() });
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Failed to update settings');
    }
  };

  const handleSaveKPIs = async () => {
    if (!currentProject?.id) return;
    
    const configuredKPIs = editedKPIs.filter(k => k.name.trim() && k.description.trim());
    
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpis: configuredKPIs.map(k => ({
            name: k.name,
            description: k.description,
            shortName: k.shortName || k.name.slice(0, 10).toUpperCase(),
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to update KPIs');
      
      addLog('SUCCESS', 'Project KPIs updated');
      setIsEditingKPIs(false);
      await fetchProjectDetail();
    } catch (err) {
      console.error('Error updating KPIs:', err);
      setError('Failed to update KPIs');
    }
  };

  const handleViewTestSet = async (testSetId: string) => {
    try {
      const res = await fetch(`/api/testsets/${testSetId}`);
      if (!res.ok) throw new Error('Failed to fetch test set');
      const data = await res.json();
      setCurrentTestSet(data.testSet);
      setScreen('RESULTS');
    } catch (err) {
      console.error('Error fetching test set:', err);
      setError('Failed to load test set');
    }
  };

  const updateEditedKPI = (index: number, field: keyof KPI, value: string) => {
    setEditedKPIs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Auto-generate short name from the KPI name (not description)
      if (field === 'name' && value.length > 0) {
        updated[index].shortName = value.trim().toUpperCase().slice(0, 10) || `KPI${index + 1}`;
      }
      return updated;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!currentProject) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No project selected</p>
        <button onClick={goToProjects} className="btn-primary mt-4">
          ← Back to Projects
        </button>
      </div>
    );
  }

  const handleSetupComplete = (updatedProject: Project) => {
    setProjectDetail({ ...projectDetail!, ...updatedProject });
    setCurrentProject(updatedProject);
    setShowSetupWizard(false);
    fetchProjectDetail(); // Refresh to get full data
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-white">Loading project...</p>
      </div>
    );
  }

  // Show Setup Wizard if triggered
  if (showSetupWizard && projectDetail) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        <button
          onClick={() => setShowSetupWizard(false)}
          className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Project
        </button>
        <ProjectSetupWizard
          project={projectDetail}
          onComplete={handleSetupComplete}
          onCancel={() => setShowSetupWizard(false)}
        />
      </div>
    );
  }

  // EMPTY STATE: Show setup required view when project needs configuration
  if (needsSetup) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
        {/* Navigation */}
        <button
          onClick={goToProjects}
          className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to All Projects
        </button>

        {/* Section 1: Setup Required Hero Card */}
        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Icon */}
            <div className="flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                <svg className="w-12 h-12 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                {currentProject.name}
              </h1>
              <h2 className="text-lg font-semibold text-slate-600 mb-3">
                Let&apos;s get your project set up
              </h2>
              <p className="text-slate-500 mb-6 max-w-lg">
                Before you can run evaluations, configure your project context and define at least one KPI (Key Performance Indicator) to measure quality.
              </p>
              <button
                onClick={() => setShowSetupWizard(true)}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Project Setup
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: KPI Placeholders (Ghost Cards) */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-1">Evaluation KPIs</h3>
          <p className="text-sm text-slate-500 mb-5">Define up to 4 key performance indicators for your evaluations</p>
          
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((num) => (
              <div
                key={num}
                className="bg-slate-50 rounded-xl p-5 border border-slate-100"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-semibold text-slate-400 bg-slate-200/50 px-2 py-1 rounded">
                    KPI {num}
                  </span>
                </div>
                <p className="text-slate-400 text-sm">
                  Not defined yet
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Test History Empty State */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-5">Test History</h3>
          
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium mb-1">No test runs yet</p>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Complete the setup wizard to configure your KPIs, then run your first evaluation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // CONFIGURED STATE: Normal project hub view
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Navigation */}
      <button
        onClick={goToProjects}
        className="text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to All Projects
      </button>

      {/* Project Header Card */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">
              {currentProject.name}
            </h1>
            {projectDetail?.siteDescription && (
              <p className="text-slate-500">{projectDetail.siteDescription}</p>
            )}
            {currentProject.description && !projectDetail?.siteDescription && (
              <p className="text-slate-500">{currentProject.description}</p>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={startNewTest} className="btn-primary">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Run New Test
            </button>
            <button
              onClick={() => setIsEditingSettings(true)}
              className="btn-secondary"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Edit Settings
            </button>
          </div>
        </div>
      </div>

      {/* Edit Settings Modal */}
      {isEditingSettings && (
        <div className="modal-overlay" onClick={() => setIsEditingSettings(false)}>
          <div className="modal-content p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Edit Project Settings</h2>
              <button 
                onClick={() => setIsEditingSettings(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-slate-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="input-label">Project Name *</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="e.g., Customer Support Bot Evaluation"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">Prompt / Agent Context *</label>
                <p className="text-sm text-slate-500 mb-2">
                  Describe what your LLM prompt or AI agent is designed to do.
                </p>
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="e.g., A customer support chatbot that answers questions about software subscriptions."
                  className="input-field resize-none"
                  rows={4}
                />
              </div>
              
              {error && (
                <div className="badge badge-error w-full justify-center py-3">
                  ⚠️ {error}
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveSettings} className="btn-primary flex-1">
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setIsEditingSettings(false);
                    setEditedName(projectDetail?.name || '');
                    setEditedDescription(projectDetail?.siteDescription || '');
                    setError(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section: Project KPIs */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Evaluation KPIs</h3>
            <p className="text-sm text-slate-500">Default criteria for evaluating LLM outputs</p>
          </div>
          {!isEditingKPIs && (
            <button
              onClick={() => setIsEditingKPIs(true)}
              className="text-purple-600 hover:text-purple-700 font-medium text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          )}
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">⚠️ {error}</div>
        )}
        
        {isEditingKPIs ? (
          <div className="space-y-4">
            {editedKPIs.map((kpi, index) => (
              <div key={index} className="bg-slate-50 rounded-xl p-5">
                <div className="text-sm font-semibold text-slate-700 mb-3">
                  KPI {index + 1}
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={kpi.name}
                    onChange={(e) => updateEditedKPI(index, 'name', e.target.value)}
                    placeholder="KPI Name (e.g., Accuracy)"
                    className="input-field"
                  />
                  <textarea
                    value={kpi.description}
                    onChange={(e) => updateEditedKPI(index, 'description', e.target.value)}
                    placeholder="Description: What is Good vs Bad?"
                    className="input-field resize-none"
                    rows={2}
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveKPIs} className="btn-primary">
                Save KPIs
              </button>
              <button
                onClick={() => setIsEditingKPIs(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            {projectDetail?.kpis && projectDetail.kpis.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {projectDetail.kpis.map((kpi: any) => (
                  <div key={kpi.id} className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded">
                        KPI {kpi.kpiNumber || kpi.id}
                      </span>
                      <span className="font-semibold text-slate-800">{kpi.name}</span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2">
                      {kpi.description}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 mb-3">No KPIs configured yet</p>
                <button
                  onClick={() => setIsEditingKPIs(true)}
                  className="btn-primary"
                >
                  Configure KPIs
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section: Test History */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-1">Test History</h3>
        <p className="text-sm text-slate-500 mb-5">Recent evaluation runs</p>
        
        {projectDetail?.testSets && projectDetail.testSets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">Name</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Records</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-slate-600">Score</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {projectDetail.testSets.map((testSet: TestSet) => (
                  <tr key={testSet.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 text-sm text-slate-600">{formatDate(testSet.createdAt)}</td>
                    <td className="py-4 px-4 text-sm font-medium text-slate-800">{testSet.name}</td>
                    <td className="py-4 px-4 text-sm text-center text-slate-600">{testSet.resultCount || 0}</td>
                    <td className="py-4 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          (testSet.overallScore || 0) >= 4
                            ? 'bg-green-100 text-green-700'
                            : (testSet.overallScore || 0) >= 3
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {testSet.overallScore?.toFixed(2) || 'N/A'} / 5
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleViewTestSet(testSet.id)}
                        className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium mb-1">No test runs yet</p>
            <p className="text-sm text-slate-400">
              Click &quot;Run New Test&quot; to evaluate your first data set
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
