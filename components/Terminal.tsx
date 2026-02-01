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
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
        <h2 className="text-lg font-semibold text-white">Query Assistant</h2>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Suggested Queries */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-3 font-medium">
            ► Try Asking:
          </p>
          <div className="flex flex-wrap gap-3">
            {suggestedQueries.map((query, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(query)}
                className="badge badge-info cursor-pointer hover:bg-blue-200 transition-colors text-sm py-2 px-4"
              >
                {query}
              </button>
            ))}
          </div>
        </div>

        {/* Chat/Output Area */}
        <div className="bg-gray-50 rounded-xl p-5 mb-6">
          <div
            ref={containerRef}
            className="h-48 overflow-y-auto"
          >
            {/* Welcome message */}
            <div className="mb-4 pb-3 border-b border-gray-200">
              <p className="font-semibold text-gray-900">KUALITEE FEEDBACK INTERFACE INITIALIZED</p>
              <p className="text-gray-600 text-sm mt-1">
                Ask questions about your evaluation results in natural language.
              </p>
            </div>

            {/* Chat history */}
            {terminalHistory.map((entry, index) => (
              <div key={`history-${index}`} className="mb-3 whitespace-pre-wrap">
                {entry.startsWith('You:') ? (
                  <span className="font-semibold text-purple-600">{entry}</span>
                ) : (
                  <span className="text-gray-800">{entry}</span>
                )}
              </div>
            ))}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="text-gray-500 animate-pulse">
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
            className="input-field flex-1"
            placeholder={isProcessing ? 'Processing...' : 'Ask a question about your results...'}
            disabled={isProcessing}
            autoFocus
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="btn-primary"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
