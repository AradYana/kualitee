'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Project } from '@/lib/types';

interface ProjectsDashboardProps {
  isCreateModalOpen?: boolean;
  onOpenCreateModal?: () => void;
  onCloseCreateModal?: () => void;
}

export default function ProjectsDashboard({ isCreateModalOpen, onOpenCreateModal, onCloseCreateModal }: ProjectsDashboardProps) {
  const { goToProjectHub, setLoading, addLog } = useAppStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoadingState] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoadingState(true);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoadingState(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setError('Project name is required');
      return;
    }
    if (!newProjectDescription.trim()) {
      setError('Prompt/Agent context is required');
      return;
    }

    setLoading(true, 'Creating project...');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          siteDescription: newProjectDescription.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to create project');

      const data = await res.json();
      addLog('SUCCESS', `Project "${data.project.name}" created`);
      
      setNewProjectName('');
      setNewProjectDescription('');
      onCloseCreateModal?.();
      await fetchProjects();
      
      goToProjectHub(data.project);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${projectName}"?`)) return;

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      addLog('INFO', `Project "${projectName}" deleted`);
      await fetchProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate mock overall score (in real app, this comes from API)
  const getOverallScore = (project: Project) => {
    if (!project.kpis || project.kpis.length === 0) return null;
    // Mock score for demo - in production this would come from actual test results
    return 4.4;
  };

  const getKPIScore = (kpiIndex: number) => {
    // Mock scores for demo
    const scores = [4.6, 4.6, 4.0, 4.5];
    return scores[kpiIndex] || 4.0;
  };

  return (
    <div className="animate-fade-in">
      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => onCloseCreateModal?.()}>
          <div className="modal-content p-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Project</h2>
            <p className="text-gray-500 mb-6">Set up a new evaluation project for your LLM outputs.</p>
            
            <div className="space-y-5">
              <div>
                <label className="input-label">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
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
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="e.g., A customer support chatbot that answers questions about software subscriptions. It should be helpful, accurate, and guide users to solutions."
                  className="input-field resize-none"
                  rows={3}
                />
              </div>
              
              {error && (
                <div className="badge badge-error w-full justify-center py-3">
                  {error}
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <button onClick={handleCreateProject} className="btn-primary flex-1">
                  Create Project
                </button>
                <button
                  onClick={() => {
                    onCloseCreateModal?.();
                    setNewProjectName('');
                    setNewProjectDescription('');
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

      {/* Main Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-white text-lg">Loading projects...</div>
        </div>
      ) : filteredProjects.length === 0 && !searchQuery ? (
        <div className="card max-w-lg mx-auto">
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <h3 className="empty-state-title">No projects yet</h3>
            <p className="empty-state-text">
              Create your first project to start evaluating LLM outputs with custom KPIs.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Projects Grid */}
          <div className="projects-grid">
            {filteredProjects.map((project) => {
              const needsSetup = !project.isConfigured || !project.kpis || project.kpis.length === 0;
              const overallScore = getOverallScore(project);
              
              return (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() => goToProjectHub(project)}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="project-card-title">{project.name}</h3>
                      <p className="project-card-date">
                        {project.lastTestSet 
                          ? `Last run: ${formatDate(project.lastTestSet.createdAt)}`
                          : 'No runs yet'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteProject(project.id, project.name, e)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {needsSetup ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-8">
                      <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 text-center">Setup required</p>
                    </div>
                  ) : (
                    <>
                      {/* Score */}
                      <div className="project-card-score">
                        <div className="score-value">
                          {overallScore?.toFixed(1) || '—'}
                          <span className="score-max">/ 5.0</span>
                        </div>
                        <p className="score-label">Overall Score</p>
                      </div>

                      {/* KPI Grid */}
                      {project.kpis && project.kpis.length > 0 && (
                        <div className="kpi-grid">
                          {project.kpis.slice(0, 4).map((kpi, index) => {
                            const score = getKPIScore(index);
                            const percentage = (score / 5) * 100;
                            return (
                              <div key={kpi.id} className="kpi-item">
                                <div className="kpi-header">
                                  <span className="kpi-label">{kpi.name}</span>
                                  <span className="kpi-value">{score.toFixed(1)}</span>
                                </div>
                                <div className="kpi-bar">
                                  <div 
                                    className="kpi-bar-fill" 
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Footer Button */}
                  <button className="btn-view-dashboard">
                    {needsSetup ? 'Complete Setup' : 'View Dashboard'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination - only show if more than 20 projects */}
          {filteredProjects.length > 20 && (
            <div className="flex justify-center mt-8">
              <div className="pagination">
                <span className="pagination-text">Page 1 of {Math.ceil(filteredProjects.length / 20)}</span>
                <button className="pagination-btn">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button className="pagination-btn active">1</button>
                <button className="pagination-btn">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
