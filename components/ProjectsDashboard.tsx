'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Project } from '@/lib/types';

export default function ProjectsDashboard() {
  const { goToProjectHub, setLoading, addLog } = useAppStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoadingState] = useState(true);

  // Fetch projects on mount
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

    setLoading(true, 'Creating project...');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create project');

      const data = await res.json();
      addLog('SUCCESS', `Project "${data.project.name}" created`);
      
      // Reset form and refresh
      setNewProjectName('');
      setNewProjectDescription('');
      setIsCreating(false);
      await fetchProjects();
      
      // Navigate to the new project
      goToProjectHub(data.project);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This will delete all test sets and results.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
      
      addLog('INFO', `Project "${projectName}" deleted`);
      await fetchProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('Failed to delete project');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>📁 All Projects</span>
          <div className="title-bar-controls">
            <button className="title-bar-btn">─</button>
            <button className="title-bar-btn">□</button>
            <button className="title-bar-btn">×</button>
          </div>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          <p className="text-sm text-text-secondary mb-4">
            Select a project to view its KPIs and test history, or create a new project.
          </p>
          
          {!isCreating ? (
            <button
              onClick={() => setIsCreating(true)}
              className="send-btn"
            >
              + Create New Project
            </button>
          ) : (
            <div className="terminal-output p-4 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Customer Support Bot Evaluation"
                  className="text-input w-full"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Description (optional)</label>
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  placeholder="Brief description of this evaluation project..."
                  className="text-input w-full resize-none"
                  rows={2}
                />
              </div>
              {error && (
                <p className="text-sm" style={{ color: '#CC0000' }}>⚠️ {error}</p>
              )}
              <div className="flex gap-3">
                <button onClick={handleCreateProject} className="send-btn">
                  Create Project
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setNewProjectName('');
                    setNewProjectDescription('');
                    setError(null);
                  }}
                  className="send-btn"
                  style={{ backgroundColor: '#808080' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>📋 Projects ({projects.length})</span>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-text-secondary">Loading projects...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-text-secondary mb-2">No projects yet</p>
              <p className="text-sm text-text-secondary">
                Create your first project to start evaluating LLM outputs
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="terminal-output p-4 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => goToProjectHub(project)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-text-primary truncate flex-1">
                      {project.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id, project.name);
                      }}
                      className="text-text-secondary hover:text-red-600 ml-2"
                      title="Delete project"
                    >
                      🗑️
                    </button>
                  </div>
                  
                  {project.description && (
                    <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  
                  <div className="text-xs text-text-secondary space-y-1">
                    <div className="flex justify-between">
                      <span>KPIs:</span>
                      <span>{project.kpis?.length || 0} configured</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Test Runs:</span>
                      <span>{project.testSetCount || 0}</span>
                    </div>
                    {project.lastTestSet && (
                      <div className="flex justify-between">
                        <span>Last Run:</span>
                        <span>{formatDate(project.lastTestSet.createdAt)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-border-gray">
                    <span className="suggestion-chip text-xs">
                      Created {formatDate(project.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
