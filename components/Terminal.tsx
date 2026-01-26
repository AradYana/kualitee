'use client';

import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

interface TerminalProps {
  onCommand: (command: string) => void;
  isProcessing?: boolean;
}

export default function Terminal({ onCommand, isProcessing = false }: TerminalProps) {
  const [input, setInput] = useState('');
  const { terminalHistory, addTerminalEntry } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      addTerminalEntry(`You: ${input}`);
      onCommand(input.trim());
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const suggestedQueries = [
    'Show low KPI scores (< 3)',
    'Summarize common failures for KPI_3',
    'Average score for health-related pages',
  ];

  return (
    <div className="terminal-window overflow-hidden">
      {/* Title Bar */}
      <div className="title-bar">
        <div className="flex items-center gap-2">
          <span>Query Assistant</span>
        </div>
        <div className="title-bar-controls">
          <button className="title-bar-btn" title="Minimize">─</button>
          <button className="title-bar-btn" title="Maximize">□</button>
          <button className="title-bar-btn" title="Close">×</button>
        </div>
      </div>

      {/* Window Content */}
      <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
        {/* Suggested Queries */}
        <div className="mb-5">
          <p className="text-xs text-text-secondary mb-3 font-semibold uppercase tracking-wide">
            ► Try Asking:
          </p>
          <div className="flex flex-wrap gap-3">
            {suggestedQueries.map((query, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(query)}
                className="suggestion-chip"
              >
                {query}
              </button>
            ))}
          </div>
        </div>

        {/* Chat/Output Area */}
        <div className="terminal-output p-4 mb-5">
          <div
            ref={containerRef}
            className="h-48 overflow-y-auto"
          >
            {/* Welcome message */}
            <div className="mb-4 pb-3 border-b border-gray-300">
              <p className="font-semibold text-text-primary">KUALITEE FEEDBACK INTERFACE INITIALIZED</p>
              <p className="text-text-secondary text-sm mt-1">
                Ask questions about your evaluation results in natural language.
              </p>
            </div>

            {/* Chat history */}
            {terminalHistory.map((entry, index) => (
              <div key={`history-${index}`} className="mb-3 whitespace-pre-wrap">
                {entry.startsWith('You:') ? (
                  <span className="font-semibold" style={{ color: '#084999' }}>{entry}</span>
                ) : (
                  <span className="text-text-primary">{entry}</span>
                )}
              </div>
            ))}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="text-text-secondary animate-pulse">
                Processing query...
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="text-input flex-1"
            placeholder={isProcessing ? 'Processing...' : 'Ask a question about your results...'}
            disabled={isProcessing}
            autoFocus
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="send-btn"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
