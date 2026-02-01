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
        <p className="text-text-secondary">No project selected</p>
        <button onClick={goToProjects} className="send-btn mt-4">
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
        <p className="text-text-secondary">Loading project...</p>
      </div>
    );
  }

  // Show Setup Wizard if triggered
  if (showSetupWizard && projectDetail) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setShowSetupWizard(false)}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back to Project
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
      <div className="space-y-6">
        {/* Navigation */}
        <button
          onClick={goToProjects}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back to All Projects
        </button>

        {/* Project Header - Setup Required */}
        <div className="terminal-window overflow-hidden">
          <div className="title-bar" style={{ backgroundColor: '#FF8C00' }}>
            <span>⚠️ {currentProject.name} - Setup Required</span>
            <div className="title-bar-controls">
              <button className="title-bar-btn">×</button>
            </div>
          </div>
          <div className="p-6 text-center" style={{ backgroundColor: '#e6e0d4' }}>
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Project Setup Required
            </h2>
            <p className="text-text-secondary mb-6 max-w-md mx-auto">
              Before you can run evaluations, you need to configure your project context and define at least one KPI (Key Performance Indicator).
            </p>
            <button
              onClick={() => setShowSetupWizard(true)}
              className="send-btn text-lg px-8 py-3"
            >
              🚀 Start Project Setup
            </button>
          </div>
        </div>

        {/* Empty KPI Slots */}
        <div className="terminal-window overflow-hidden">
          <div className="title-bar">
            <span>⚙️ Project KPIs (Not Configured)</span>
          </div>
          <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
            <div className="grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((num) => (
                <div
                  key={num}
                  className="terminal-output p-4 border-2 border-dashed"
                  style={{ borderColor: '#808080', opacity: 0.5 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="suggestion-chip text-xs" style={{ backgroundColor: '#ccc' }}>
                      KPI_{num}
                    </span>
                    <span className="text-text-secondary italic">Not defined</span>
                  </div>
                  <p className="text-xs text-text-secondary italic">
                    Configure in setup wizard
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Empty Test History */}
        <div className="terminal-window overflow-hidden">
          <div className="title-bar">
            <span>📊 Test History</span>
          </div>
          <div className="p-8 text-center" style={{ backgroundColor: '#e6e0d4' }}>
            <div className="text-4xl mb-3 opacity-30">📋</div>
            <p className="text-text-secondary mb-2">
              Your test history will appear here
            </p>
            <p className="text-sm text-text-secondary">
              Once you&apos;ve configured your project and uploaded your first data set, you&apos;ll see your evaluation runs listed here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // CONFIGURED STATE: Normal project hub view
  return (
    <div className="space-y-6">
      {/* Navigation */}
      <button
        onClick={goToProjects}
        className="text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        ← Back to All Projects
      </button>

      {/* Project Header */}
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>📂 {currentProject.name}</span>
          <div className="title-bar-controls">
            <button className="title-bar-btn">─</button>
            <button className="title-bar-btn">□</button>
            <button className="title-bar-btn">×</button>
          </div>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          {/* Project Context Info */}
          {projectDetail?.siteDescription && (
            <div className="mb-4">
              <p className="text-sm text-text-secondary">{projectDetail.siteDescription}</p>
              {projectDetail.targetLanguage && (
                <span className="suggestion-chip text-xs mt-2 inline-block">
                  🌐 {projectDetail.targetLanguage}
                </span>
              )}
            </div>
          )}
          {currentProject.description && !projectDetail?.siteDescription && (
            <p className="text-sm text-text-secondary mb-4">{currentProject.description}</p>
          )}
          
          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={startNewTest} className="send-btn">
              🚀 Run New Test
            </button>
            <button
              onClick={() => setShowSetupWizard(true)}
              className="send-btn"
              style={{ backgroundColor: '#808080' }}
            >
              ⚙️ Edit Project Settings
            </button>
          </div>
        </div>
      </div>

      {/* Section A: Project KPIs */}
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>⚙️ Project KPIs (Default Evaluation Criteria)</span>
          <div className="title-bar-controls">
            {!isEditingKPIs && (
              <button
                onClick={() => setIsEditingKPIs(true)}
                className="title-bar-btn"
                title="Edit KPIs"
              >
                ✏️
              </button>
            )}
          </div>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          {error && (
            <p className="text-sm mb-4" style={{ color: '#CC0000' }}>⚠️ {error}</p>
          )}
          
          {isEditingKPIs ? (
            <div className="space-y-4">
              {editedKPIs.map((kpi, index) => (
                <div key={index} className="terminal-output p-4">
                  <div className="text-sm font-semibold text-text-primary mb-2">
                    KPI #{index + 1} {kpi.shortName && `[${kpi.shortName}]`}
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={kpi.name}
                      onChange={(e) => updateEditedKPI(index, 'name', e.target.value)}
                      placeholder="KPI Name (e.g., Accuracy)"
                      className="text-input w-full"
                    />
                    <textarea
                      value={kpi.description}
                      onChange={(e) => updateEditedKPI(index, 'description', e.target.value)}
                      placeholder="Description: What is Good vs Bad?"
                      className="text-input w-full resize-none"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <button onClick={handleSaveKPIs} className="send-btn">
                  Save KPIs
                </button>
                <button
                  onClick={() => setIsEditingKPIs(false)}
                  className="send-btn"
                  style={{ backgroundColor: '#808080' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {projectDetail?.kpis && projectDetail.kpis.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {projectDetail.kpis.map((kpi: any) => (
                    <div key={kpi.id} className="terminal-output p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="suggestion-chip text-xs">{kpi.shortName}</span>
                        <span className="font-semibold text-text-primary">{kpi.name}</span>
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-2">
                        {kpi.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-text-secondary mb-2">No KPIs configured yet</p>
                  <button
                    onClick={() => setIsEditingKPIs(true)}
                    className="send-btn"
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
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>📊 Test History (Last 100 Runs)</span>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          {projectDetail?.testSets && projectDetail.testSets.length > 0 ? (
            <div className="terminal-output overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-center p-2">Records</th>
                    <th className="text-center p-2">Overall Score</th>
                    <th className="text-center p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {projectDetail.testSets.map((testSet: TestSet) => (
                    <tr key={testSet.id} className="border-t border-border-gray">
                      <td className="p-2 text-sm">{formatDate(testSet.createdAt)}</td>
                      <td className="p-2 text-sm font-medium">{testSet.name}</td>
                      <td className="p-2 text-sm text-center">{testSet.resultCount || 0}</td>
                      <td className="p-2 text-center">
                        <span
                          className={`suggestion-chip text-xs ${
                            (testSet.overallScore || 0) >= 4
                              ? 'bg-green-200'
                              : (testSet.overallScore || 0) >= 3
                              ? 'bg-yellow-200'
                              : 'bg-red-200'
                          }`}
                        >
                          {testSet.overallScore?.toFixed(2) || 'N/A'}/5
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleViewTestSet(testSet.id)}
                          className="text-sm text-title-bar hover:underline"
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
              <p className="text-text-secondary mb-2">No test runs yet</p>
              <p className="text-sm text-text-secondary">
                Click &quot;Run New Test&quot; to evaluate your first data set
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
