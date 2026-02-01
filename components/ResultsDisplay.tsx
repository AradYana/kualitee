'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';

interface ResultsDisplayProps {
  filterFailures?: boolean;
}

export default function ResultsDisplay({ filterFailures = false }: ResultsDisplayProps) {
  const { evaluationResults, kpis, dataMismatchLog, currentTestSet } = useAppStore();
  
  // Use KPIs from test set if available (for historical views), otherwise use current
  // Filter to only include KPIs that are actually configured (have a name)
  const activeKPIs = useMemo(() => {
    let kpiSource = kpis;
    if (currentTestSet?.kpis && currentTestSet.kpis.length > 0) {
      kpiSource = currentTestSet.kpis;
    }
    // Only include KPIs that have a name (are actually configured)
    return kpiSource.filter(k => k.name && k.name.trim().length > 0);
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

    return activeKPIs
      .map((kpi) => {
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
      })
      // Only include KPIs that have actual results
      .filter(stat => stat.count > 0);
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
      <div className="card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-orange-500">
          <h2 className="text-lg font-semibold text-white">⚠️ Error</h2>
        </div>
        <div className="p-6 text-center">
          <p className="font-bold mb-2 text-red-600">No evaluation results available</p>
          <p className="text-sm text-gray-600">
            This usually means the Anthropic API key is not configured.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Add your key to <code className="px-2 py-1 bg-gray-100 rounded">`.env.local`</code>:
          </p>
          <p className="text-sm font-mono bg-gray-100 px-4 py-2 rounded mt-2 inline-block">
            ANTHROPIC_API_KEY=sk-ant-your-key-here
          </p>
        </div>
      </div>
    );
  }

  const getStatusColor = (score: number) => {
    if (score >= 4.5) return '#15803D'; // Green-700 - darker for better contrast
    if (score >= 3.5) return '#16A34A'; // Green-600
    if (score >= 2.5) return '#B45309'; // Amber-700 - darker for better contrast
    return '#B91C1C'; // Red-700 - darker for better contrast
  };

  const getStatusText = (score: number) => {
    if (score >= 4.5) return 'OPTIMAL';
    if (score >= 3.5) return 'GOOD';
    if (score >= 2.5) return 'MARGINAL';
    return 'CRITICAL';
  };

  const getStatusBadge = (score: number) => {
    if (score >= 4.5) return 'badge-success';
    if (score >= 3.5) return 'badge-success';
    if (score >= 2.5) return 'badge-warning';
    return 'badge-error';
  };

  const overallMean = summaryStats.length > 0
    ? summaryStats.reduce((acc, s) => acc + s.mean, 0) / summaryStats.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-lg font-semibold text-white">📊 Summary Statistics</h2>
        </div>
        <div className="p-6">
          {/* Overview */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="text-sm text-gray-600">
              Total Records: <span className="font-bold text-gray-900">{evaluationResults.length}</span>
            </div>
            <div className="h-4 w-px bg-gray-300" />
            <div className="text-sm text-gray-600">
              Overall Score: 
              <span className="ml-2 font-bold" style={{ color: getStatusColor(overallMean) }}>
                {overallMean.toFixed(2)} / 5.00
              </span>
              <span className={`ml-2 badge ${getStatusBadge(overallMean)}`}>
                {getStatusText(overallMean)}
              </span>
            </div>
          </div>

          {/* KPI Stats Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">KPI Name</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Mean</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Median</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Samples</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {summaryStats.map((stat, index) => (
                  <tr key={stat.kpiId} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <span className="text-xs font-semibold text-purple-600 bg-purple-100 px-2 py-1 rounded mr-2">
                        KPI {index + 1}
                      </span>
                      <span className="text-gray-900 font-medium">{stat.kpiName}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold" style={{ color: getStatusColor(stat.mean) }}>{stat.mean.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center font-bold" style={{ color: getStatusColor(stat.median) }}>{stat.median.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center text-gray-600">{stat.count}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`badge ${getStatusBadge(stat.mean)}`}>{getStatusText(stat.mean)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Results */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
          <h2 className="text-lg font-semibold text-white">
            📋 Detailed Results {filterFailures && '(Failures Only)'}
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">
            Showing {detailedResults.length} records • Hover over scores for justifications
          </p>

          <div className="overflow-x-auto">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">MSID</th>
                    {activeKPIs.map((kpi) => (
                      <th key={kpi.id} className="text-center py-3 px-4 text-sm font-semibold text-gray-600">
                        {kpi.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailedResults.map((result: any) => (
                    <tr key={result.msid} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm font-medium text-gray-900">{result.msid}</td>
                      {activeKPIs.map((kpi) => {
                        const kpiKey = kpi.shortName || `KPI_${kpi.id}`;
                        const scoreData = result.scores[kpiKey];
                        const score = scoreData?.score || 0;
                        return (
                          <td
                            key={kpi.id}
                            className="py-3 px-4 text-center cursor-help font-bold"
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
            <summary className="cursor-pointer text-sm text-purple-600 hover:text-purple-800 font-medium">
              📖 View full justifications
            </summary>
            <div className="bg-gray-50 rounded-xl p-4 mt-3 max-h-48 overflow-y-auto">
              {detailedResults.slice(0, 20).map((result: any) => (
                <div key={result.msid} className="mb-3 text-sm border-b border-gray-200 pb-2 last:border-0">
                  <div className="font-bold text-purple-600">MSID: {result.msid}</div>
                  {activeKPIs.map((kpi) => {
                    const kpiKey = kpi.shortName || `KPI_${kpi.id}`;
                    const scoreData = result.scores[kpiKey];
                    return (
                      <div key={kpi.id} className="ml-3 text-gray-600 text-sm">
                        <span className="font-medium text-slate-700">{kpi.name}:</span> Score: {scoreData?.score || '-'} — {scoreData?.justification || 'N/A'}
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
      <div className="card overflow-hidden">
        <div className={`px-6 py-4 bg-gradient-to-r ${systemLogs.length > 0 ? 'from-orange-500 to-amber-500' : 'from-green-500 to-emerald-500'}`}>
          <h2 className="text-lg font-semibold text-white">
            {systemLogs.length > 0 ? '⚠️' : '✅'} System Logs
          </h2>
        </div>
        <div className="p-6">
          {systemLogs.length === 0 ? (
            <div className="badge badge-success">
              ✓ No data integrity issues detected
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-orange-600 mb-4">
                {systemLogs.length} data integrity issue(s) detected
              </p>
              <div className="overflow-x-auto">
                <div className="max-h-32 overflow-y-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">#</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Type</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">MSID</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Field</th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-gray-600">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {systemLogs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-100">
                          <td className="py-2 px-3 text-sm text-gray-600">{log.id}</td>
                          <td className="py-2 px-3 text-sm text-orange-600 font-medium">{log.type}</td>
                          <td className="py-2 px-3 text-sm text-gray-900">{log.msid}</td>
                          <td className="py-2 px-3 text-sm text-gray-600">{log.field}</td>
                          <td className="py-2 px-3 text-sm text-gray-600">{log.message}</td>
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
