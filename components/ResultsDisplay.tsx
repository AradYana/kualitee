'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';

interface ResultsDisplayProps {
  filterFailures?: boolean;
}

export default function ResultsDisplay({ filterFailures = false }: ResultsDisplayProps) {
  const { evaluationResults, kpis, dataMismatchLog, currentTestSet } = useAppStore();
  
  // Use KPIs from test set if available (for historical views), otherwise use current
  const activeKPIs = useMemo(() => {
    if (currentTestSet?.kpis && currentTestSet.kpis.length > 0) {
      return currentTestSet.kpis;
    }
    return kpis;
  }, [currentTestSet, kpis]);

  // Use data mismatches from test set if available
  const activeMismatches = useMemo(() => {
    if (currentTestSet?.dataMismatches && currentTestSet.dataMismatches.length > 0) {
      return currentTestSet.dataMismatches.map((m, i) => ({
        msid: m.msid,
        field: m.field,
      }));
    }
    return dataMismatchLog;
  }, [currentTestSet, dataMismatchLog]);

  const summaryStats = useMemo(() => {
    if (!evaluationResults || evaluationResults.length === 0) return [];

    return activeKPIs.map((kpi) => {
      const scores = evaluationResults
        .flatMap((r) => r.scores.filter((s: any) => s.kpiId === kpi.id))
        .map((s: any) => s.score)
        .filter((s: number) => s > 0);

      if (scores.length === 0) {
        return { kpiId: kpi.id, kpiName: kpi.name, shortName: kpi.shortName, mean: 0, median: 0, count: 0 };
      }

      const mean = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
      const sorted = [...scores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

      return { kpiId: kpi.id, kpiName: kpi.name, shortName: kpi.shortName, mean, median, count: scores.length };
    });
  }, [evaluationResults, activeKPIs]);

  const detailedResults = useMemo(() => {
    if (!evaluationResults) return [];

    const results = evaluationResults.map((result: any) => {
      const kpiScores: Record<string, { score: number; justification: string }> = {};
      
      result.scores.forEach((score: any) => {
        const kpi = activeKPIs.find(k => k.id === score.kpiId);
        const kpiKey = kpi?.shortName || `KPI_${score.kpiId}`;
        kpiScores[kpiKey] = { score: score.score, justification: score.explanation };
      });

      return { msid: result.msid, scores: kpiScores };
    });

    if (filterFailures) {
      return results.filter((r: any) => Object.values(r.scores).some((s: any) => s.score < 3));
    }

    return results;
  }, [evaluationResults, activeKPIs, filterFailures]);

  const systemLogs = useMemo(() => {
    return activeMismatches.map((mismatch, index) => ({
      id: index + 1, type: 'DATA_MISMATCH', msid: mismatch.msid, field: mismatch.field, message: 'Empty cell detected',
    }));
  }, [activeMismatches]);

  if (!evaluationResults || evaluationResults.length === 0) {
    return (
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>⚠️ Error</span>
          <div className="title-bar-controls">
            <button className="title-bar-btn">×</button>
          </div>
        </div>
        <div className="p-6 text-center" style={{ backgroundColor: '#e6e0d4' }}>
          <p className="font-bold mb-2" style={{ color: '#CC0000' }}>No evaluation results available</p>
          <p className="text-sm text-text-secondary">
            This usually means the Anthropic API key is not configured.
          </p>
          <p className="text-sm text-text-secondary mt-2">
            Add your key to <code className="px-1" style={{ backgroundColor: '#FFFFFF' }}>.env.local</code>:
          </p>
          <p className="text-sm font-mono p-2 mt-2 inline-block" style={{ backgroundColor: '#FFFFFF' }}>
            ANTHROPIC_API_KEY=sk-ant-your-key-here
          </p>
        </div>
      </div>
    );
  }

  const getStatusColor = (score: number) => {
    if (score >= 4.5) return '#008000';
    if (score >= 3.5) return '#228B22';
    if (score >= 2.5) return '#FF8C00';
    return '#CC0000';
  };

  const getStatusText = (score: number) => {
    if (score >= 4.5) return 'OPTIMAL';
    if (score >= 3.5) return 'GOOD';
    if (score >= 2.5) return 'MARGINAL';
    return 'CRITICAL';
  };

  const overallMean = summaryStats.length > 0
    ? summaryStats.reduce((acc, s) => acc + s.mean, 0) / summaryStats.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>📊 Summary Statistics</span>
          <div className="title-bar-controls">
            <button className="title-bar-btn">─</button>
            <button className="title-bar-btn">□</button>
            <button className="title-bar-btn">×</button>
          </div>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          {/* Overview */}
          <div className="suggestion-chip inline-block mb-4">
            Total Records: {evaluationResults.length} | 
            Overall Score: <span style={{ color: getStatusColor(overallMean), fontWeight: 'bold' }}>
              {overallMean.toFixed(2)} / 5.00 [{getStatusText(overallMean)}]
            </span>
          </div>

          {/* KPI Stats Table */}
          <div className="terminal-output overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Name</th>
                  <th>Mean</th>
                  <th>Median</th>
                  <th>Samples</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {summaryStats.map((stat) => (
                  <tr key={stat.kpiId}>
                    <td className="font-bold">[{stat.shortName}]</td>
                    <td>{stat.kpiName}</td>
                    <td style={{ color: getStatusColor(stat.mean), fontWeight: 'bold' }}>{stat.mean.toFixed(2)}</td>
                    <td style={{ color: getStatusColor(stat.median), fontWeight: 'bold' }}>{stat.median.toFixed(2)}</td>
                    <td>{stat.count}</td>
                    <td style={{ color: getStatusColor(stat.mean), fontWeight: 'bold' }}>{getStatusText(stat.mean)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Results */}
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>📋 Detailed Results {filterFailures && '(Failures Only)'}</span>
          <div className="title-bar-controls">
            <button className="title-bar-btn">─</button>
            <button className="title-bar-btn">□</button>
            <button className="title-bar-btn">×</button>
          </div>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          <p className="text-xs text-text-secondary mb-3">
            Showing {detailedResults.length} records • Hover over scores for justifications
          </p>

          <div className="terminal-output overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="data-table">
                <thead className="sticky top-0">
                  <tr>
                    <th>MSID</th>
                    {activeKPIs.map((kpi) => (
                      <th key={kpi.id}>{kpi.shortName || `KPI_${kpi.id}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailedResults.map((result: any) => (
                    <tr key={result.msid}>
                      <td className="font-mono font-bold">{result.msid}</td>
                      {activeKPIs.map((kpi) => {
                        const kpiKey = kpi.shortName || `KPI_${kpi.id}`;
                        const scoreData = result.scores[kpiKey];
                        const score = scoreData?.score || 0;
                        return (
                          <td
                            key={kpi.id}
                            className="text-center cursor-help font-bold"
                            style={{ color: getStatusColor(score) }}
                            title={scoreData?.justification || 'N/A'}
                          >
                            {score > 0 ? score : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm hover:underline" style={{ color: '#084999' }}>
              📖 View full justifications
            </summary>
            <div className="terminal-output p-3 mt-2 max-h-48 overflow-y-auto">
              {detailedResults.slice(0, 20).map((result: any) => (
                <div key={result.msid} className="mb-3 text-xs border-b border-gray-200 pb-2">
                  <div className="font-bold" style={{ color: '#084999' }}>MSID: {result.msid}</div>
                  {activeKPIs.map((kpi) => {
                    const kpiKey = kpi.shortName || `KPI_${kpi.id}`;
                    const scoreData = result.scores[kpiKey];
                    return (
                      <div key={kpi.id} className="ml-3 text-text-secondary">
                        [{kpiKey}] Score: {scoreData?.score || '-'} — {scoreData?.justification || 'N/A'}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>

      {/* System Logs */}
      <div className="terminal-window overflow-hidden">
        <div className="title-bar">
          <span>{systemLogs.length > 0 ? '⚠️' : '✅'} System Logs</span>
          <div className="title-bar-controls">
            <button className="title-bar-btn">─</button>
            <button className="title-bar-btn">□</button>
            <button className="title-bar-btn">×</button>
          </div>
        </div>
        <div className="p-5" style={{ backgroundColor: '#e6e0d4' }}>
          {systemLogs.length === 0 ? (
            <div className="suggestion-chip inline-block">
              <span style={{ color: '#008000' }}>✓ No data integrity issues detected</span>
            </div>
          ) : (
            <>
              <p className="text-xs mb-3 font-bold" style={{ color: '#FF8C00' }}>
                {systemLogs.length} data integrity issue(s) detected
              </p>
              <div className="terminal-output overflow-hidden">
                <div className="max-h-32 overflow-y-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Type</th>
                        <th>MSID</th>
                        <th>Field</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.id}</td>
                          <td style={{ color: '#FF8C00' }}>{log.type}</td>
                          <td>{log.msid}</td>
                          <td>{log.field}</td>
                          <td>{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
