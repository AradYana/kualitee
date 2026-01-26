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
      addTerminalEntry(`C:\\USER\\KUALITEE> ${input}`);
      onCommand(input.trim());
      setInput('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  return (
    <div className="border border-matrix-green bg-black/50">
      {/* Terminal Header */}
      <div className="border-b border-matrix-green px-3 py-1 flex justify-between items-center">
        <span className="text-matrix-green/60 text-sm">
          ┌─ KUALITEE TERMINAL v1.0 ─┐
        </span>
        <span className="text-matrix-green/40 text-xs">
          Feedback & Analysis
        </span>
      </div>

      {/* Suggestions */}
      <div className="border-b border-matrix-green/30 px-3 py-2 bg-black/30">
        <div className="text-matrix-green/50 text-xs mb-2">
          ► TRY ASKING:
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSuggestionClick('Show all MSIDs where KPI_1 < 3')}
            className="text-xs text-warning-amber hover:text-matrix-green border border-warning-amber/50 hover:border-matrix-green px-2 py-1 transition-colors"
          >
            &quot;Show all MSIDs where KPI_1 &lt; 3&quot;
          </button>
          <button
            onClick={() => handleSuggestionClick('Summarize common failure reasons for KPI_3')}
            className="text-xs text-warning-amber hover:text-matrix-green border border-warning-amber/50 hover:border-matrix-green px-2 py-1 transition-colors"
          >
            &quot;Summarize common failure reasons for KPI_3&quot;
          </button>
          <button
            onClick={() => handleSuggestionClick('Show average score for pages with health related essence')}
            className="text-xs text-warning-amber hover:text-matrix-green border border-warning-amber/50 hover:border-matrix-green px-2 py-1 transition-colors"
          >
            &quot;Show average score for pages with health related essence&quot;
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={containerRef}
        className="h-48 overflow-y-auto p-3 font-mono text-sm"
      >
        {/* Boot message */}
        <div className="text-matrix-green/60 mb-2">
          KUALITEE FEEDBACK INTERFACE INITIALIZED
          <br />
          Ask questions about your evaluation results in natural language.
          <br />
          ─────────────────────────────────────────
        </div>

        {/* Terminal history */}
        {terminalHistory.map((entry, index) => (
          <div key={`history-${index}`} className="text-matrix-green whitespace-pre-wrap">
            {entry}
          </div>
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="text-warning-amber animate-pulse">
            PROCESSING QUERY...
          </div>
        )}
      </div>

      {/* Terminal Input */}
      <form onSubmit={handleSubmit} className="border-t border-matrix-green p-2">
        <div className="flex items-center">
          <span className="text-matrix-green mr-2">C:\USER\KUALITEE&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-matrix-green cursor-blink"
            placeholder={isProcessing ? 'Processing...' : 'Ask a question about your results...'}
            disabled={isProcessing}
            autoFocus
          />
        </div>
      </form>
    </div>
  );
}
