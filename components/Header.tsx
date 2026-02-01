'use client';

import { useAppStore } from '@/lib/store';

interface HeaderProps {
  onNewProject?: () => void;
}

export default function Header({ onNewProject }: HeaderProps) {
  const { currentProject, goToProjects } = useAppStore();

  return (
    <header className="app-header">
      {/* Logo Area */}
      <div className="header-logo cursor-pointer" onClick={goToProjects}>
        <div className="header-logo-icon">K</div>
        <span className="header-logo-text">Kualitee</span>
        <div className="header-divider" />
        <span className="header-subtitle">Automated LLM<br />QA System V1.0</span>
      </div>

      {/* Search Bar */}
      <div className="search-bar relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search projects..."
        />
      </div>

      {/* Right Actions */}
      <div className="header-actions">
        {onNewProject && (
          <button className="btn-primary" onClick={onNewProject}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        )}
        
        {/* Notification Bell */}
        <button className="notification-btn">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>

        {/* User Avatar */}
        <div className="user-avatar">
          <img 
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face" 
            alt="User"
          />
        </div>
      </div>
    </header>
  );
}
