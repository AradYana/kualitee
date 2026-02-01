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
      // Auto-generate short name
      if (field === 'description' && value.length > 0) {
        const words = value.split(' ').filter(w => w.length > 3);
        updated[index].shortName = words[0]?.toUpperCase().slice(0, 10) || `KPI${index + 1}`;
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
      <div className="space-y-6 animate-fade-in">
        <button
          onClick={() => setShowSetupWizard(false)}
          className="text-white/80 hover:text-white transition-colors flex items-center gap-2"
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
      <div className="space-y-6 animate-fade-in">
        {/* Navigation */}
        <button
          onClick={goToProjects}
          className="text-white/80 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to All Projects
        </button>

        {/* Project Header - Setup Required */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-amber-500">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span>⚠️</span> {currentProject.name} - Setup Required
            </h2>
          </div>
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Project Setup Required
            </h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Before you can run evaluations, you need to configure your project context and define at least one KPI (Key Performance Indicator).
            </p>
            <button
              onClick={() => setShowSetupWizard(true)}
              className="btn-primary text-lg px-8 py-3"
            >
              🚀 Start Project Setup
            </button>
          </div>
        </div>

        {/* Empty KPI Slots */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
            <h2 className="text-lg font-semibold text-white">⚙️ Project KPIs (Not Configured)</h2>
          </div>
          <div className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((num) => (
                <div
                  key={num}
                  className="bg-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-300 opacity-50"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-info opacity-50">KPI_{num}</span>
                    <span className="text-gray-400 italic">Not defined</span>
                  </div>
                  <p className="text-sm text-gray-400 italic">
                    Configure in setup wizard
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Empty Test History */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
            <h2 className="text-lg font-semibold text-white">📊 Test History</h2>
          </div>
          <div className="p-8 text-center">
            <div className="text-4xl mb-3 opacity-30">📋</div>
            <p className="text-gray-600 mb-2">
              Your test history will appear here
            </p>
            <p className="text-sm text-gray-500">
              Once you&apos;ve configured your project and uploaded your first data set, you&apos;ll see your evaluation runs listed here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // CONFIGURED STATE: Normal project hub view
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Navigation */}
      <button
        onClick={goToProjects}
        className="text-white/80 hover:text-white transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to All Projects
      </button>

      {/* Project Header */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>📂</span> {currentProject.name}
          </h2>
        </div>
        <div className="p-6">
          {/* Project Context Info */}
          {projectDetail?.siteDescription && (
            <p className="text-gray-600 mb-4">{projectDetail.siteDescription}</p>
          )}
          {currentProject.description && !projectDetail?.siteDescription && (
            <p className="text-gray-600 mb-4">{currentProject.description}</p>
          )}
          
          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={startNewTest} className="btn-primary">
              🚀 Run New Test
            </button>
            <button
              onClick={() => setShowSetupWizard(true)}
              className="btn-secondary"
            >
              ⚙️ Edit Project Settings
            </button>
          </div>
        </div>
      </div>

      {/* Section A: Project KPIs */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">⚙️ Project KPIs (Default Evaluation Criteria)</h2>
          {!isEditingKPIs && (
            <button
              onClick={() => setIsEditingKPIs(true)}
              className="text-white/80 hover:text-white transition-colors"
              title="Edit KPIs"
            >
              ✏️
            </button>
          )}
        </div>
        <div className="p-6">
          {error && (
            <div className="badge badge-error w-full justify-center py-3 mb-4">⚠️ {error}</div>
          )}
          
          {isEditingKPIs ? (
            <div className="space-y-4">
              {editedKPIs.map((kpi, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-semibold text-gray-800 mb-3">
                    KPI #{index + 1} {kpi.shortName && `[${kpi.shortName}]`}
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
                    <div key={kpi.id} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="badge badge-info">{kpi.shortName}</span>
                        <span className="font-semibold text-gray-900">{kpi.name}</span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {kpi.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 mb-2">No KPIs configured yet</p>
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
      </div>

      {/* Section C: Test History */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-lg font-semibold text-white">📊 Test History (Last 100 Runs)</h2>
        </div>
        <div className="p-6">
          {projectDetail?.testSets && projectDetail.testSets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Name</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Records</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Overall Score</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projectDetail.testSets.map((testSet: TestSet) => (
                    <tr key={testSet.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(testSet.createdAt)}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">{testSet.name}</td>
                      <td className="py-3 px-4 text-sm text-center text-gray-600">{testSet.resultCount || 0}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`badge ${
                            (testSet.overallScore || 0) >= 4
                              ? 'badge-success'
                              : (testSet.overallScore || 0) >= 3
                              ? 'badge-warning'
                              : 'badge-error'
                          }`}
                        >
                          {testSet.overallScore?.toFixed(2) || 'N/A'}/5
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleViewTestSet(testSet.id)}
                          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                        >
                          View Results →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-2">No test runs yet</p>
              <p className="text-sm text-gray-500">
                Click &quot;Run New Test&quot; to evaluate your first data set
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
