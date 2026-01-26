'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';

interface ResultsDisplayProps {
  filterFailures?: boolean;
}

export default function ResultsDisplay({ filterFailures = false }: ResultsDisplayProps) {
  const { evaluationResults, kpis, dataMismatchLog } = useAppStore();

  // Calculate summary statistics with Mean and Median
  const summaryStats = useMemo(() => {
    if (!evaluationResults || evaluationResults.length === 0) return [];

    return kpis.map((kpi) => {
      const scores = evaluationResults
        .flatMap((r) => r.scores.filter((s: any) => s.kpiId === kpi.id))
        .map((s: any) => s.score)
        .filter((s: number) => s > 0); // Filter out failed evaluations

      if (scores.length === 0) {
        return {
          kpiId: kpi.id,
          kpiName: kpi.name,
          shortName: kpi.shortName,
          mean: 0,
          median: 0,
          count: 0,
        };
      }

      // Calculate mean
      const mean = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

      // Calculate median
      const sorted = [...scores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;

      return {
        kpiId: kpi.id,
        kpiName: kpi.name,
        shortName: kpi.shortName,
        mean: mean,
        median: median,
        count: scores.length,
      };
    });
  }, [evaluationResults, kpis]);

  // Build detailed results array
  const detailedResults = useMemo(() => {
    if (!evaluationResults) return [];

    const results = evaluationResults.map((result: any) => {
      const kpiScores: Record<string, { score: number; justification: string }> = {};
      
      result.scores.forEach((score: any) => {
        const kpi = kpis.find(k => k.id === score.kpiId);
        const kpiKey = kpi?.shortName || `KPI_${score.kpiId}`;
        kpiScores[kpiKey] = {
          score: score.score,
          justification: score.explanation,
        };
      });

      return {
        msid: result.msid,
        scores: kpiScores,
      };
    });

    // Apply filter if showing failures only
    if (filterFailures) {
      return results.filter((r: any) => 
        Object.values(r.scores).some((s: any) => s.score < 3)
      );
    }

    return results;
  }, [evaluationResults, kpis, filterFailures]);

  // System logs (data mismatches)
  const systemLogs = useMemo(() => {
    return dataMismatchLog.map((mismatch, index) => ({
      id: index + 1,
      type: 'DATA_MISMATCH',
      msid: mismatch.msid,
      field: mismatch.field,
      message: 'Empty cell detected',
    }));
  }, [dataMismatchLog]);

  if (!evaluationResults || evaluationResults.length === 0) {
    return (
      <div className="text-center text-warning-amber p-8">
        No evaluation results available.
      </div>
    );
  }

  const getStatusIndicator = (score: number) => {
    if (score >= 4.5) return { text: 'OPTIMAL', color: 'text-matrix-green' };
    if (score >= 3.5) return { text: 'GOOD', color: 'text-matrix-green/80' };
    if (score >= 2.5) return { text: 'MARGINAL', color: 'text-warning-amber' };
    return { text: 'CRITICAL', color: 'text-error-red' };
  };

  const overallMean = summaryStats.length > 0
    ? summaryStats.reduce((acc, s) => acc + s.mean, 0) / summaryStats.length
    : 0;
  const status = getStatusIndicator(overallMean);

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="border border-matrix-green p-4">
        <div className="text-matrix-green mb-3">
          ╔═══════════════════════════════════════════════════════╗
          <br />
          ║&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ANALYSIS RESULTS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;║
          <br />
          ╚═══════════════════════════════════════════════════════╝
        </div>

        <div className="font-mono text-sm space-y-2">
          <div>
            TOTAL RECORDS EVALUATED: {evaluationResults.length}
          </div>
          <div>
            OVERALL STATUS:{' '}
            <span className={status.color}>[{status.text}]</span>
          </div>
          <div>
            AGGREGATE MEAN SCORE: {overallMean.toFixed(2)} / 5.00
          </div>
        </div>
      </div>

      {/* SECTION 1: summary_stats - Mean/Median scores per KPI */}
      <div className="border border-matrix-green p-4">
        <div className="text-matrix-green mb-3">
          ┌─── summary_stats: KPI STATISTICS ───┐
        </div>

        <table className="dos-table w-full text-sm">
          <thead>
            <tr>
              <th>KPI</th>
              <th>NAME</th>
              <th>MEAN</th>
              <th>MEDIAN</th>
              <th>SAMPLES</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {summaryStats.map((stat) => {
              const kpiStatus = getStatusIndicator(stat.mean);
              return (
                <tr key={stat.kpiId}>
                  <td className="text-warning-amber">[{stat.shortName}]</td>
                  <td>{stat.kpiName}</td>
                  <td className={kpiStatus.color}>{stat.mean.toFixed(2)}</td>
                  <td className={kpiStatus.color}>{stat.median.toFixed(2)}</td>
                  <td>{stat.count}</td>
                  <td className={kpiStatus.color}>{kpiStatus.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="text-matrix-green/60 mt-2">
          └─────────────────────────────────────────────────────────┘
        </div>
      </div>

      {/* SECTION 2: detailed_results - Array of MSID, scores, justifications */}
      <div className="border border-matrix-green p-4">
        <div className="text-matrix-green mb-3">
          ┌─── detailed_results: EVALUATION DATA {filterFailures && '(FAILURES ONLY)'} ───┐
        </div>

        <div className="text-matrix-green/60 text-xs mb-2">
          Showing {detailedResults.length} records | Hover over scores for justifications
        </div>

        <div className="max-h-96 overflow-y-auto">
          <table className="dos-table w-full text-xs">
            <thead className="sticky top-0 bg-dos-black">
              <tr>
                <th>MSID</th>
                {kpis.map((kpi) => (
                  <th key={kpi.id}>
                    {kpi.shortName || `KPI_${kpi.id}`}
                    <br />
                    <span className="text-matrix-green/50 font-normal">score</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailedResults.map((result: any) => (
                <tr key={result.msid}>
                  <td className="font-bold">{result.msid}</td>
                  {kpis.map((kpi) => {
                    const kpiKey = kpi.shortName || `KPI_${kpi.id}`;
                    const scoreData = result.scores[kpiKey];
                    const score = scoreData?.score || 0;
                    const justification = scoreData?.justification || 'N/A';
                    const scoreStatus = getStatusIndicator(score);
                    return (
                      <td
                        key={kpi.id}
                        className={`${scoreStatus.color} cursor-help`}
                        title={`Justification: ${justification}`}
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

        {/* Expanded view for justifications */}
        <details className="mt-4">
          <summary className="text-matrix-green cursor-pointer hover:text-matrix-green/80">
            ► Click to expand full justifications
          </summary>
          <div className="mt-2 max-h-64 overflow-y-auto border border-matrix-green/30 p-2">
            {detailedResults.slice(0, 20).map((result: any) => (
              <div key={result.msid} className="mb-3 text-xs">
                <div className="text-warning-amber font-bold">MSID: {result.msid}</div>
                {kpis.map((kpi) => {
                  const kpiKey = kpi.shortName || `KPI_${kpi.id}`;
                  const scoreData = result.scores[kpiKey];
                  return (
                    <div key={kpi.id} className="ml-2 text-matrix-green/80">
                      [{kpiKey}] Score: {scoreData?.score || '-'} | {scoreData?.justification || 'N/A'}
                    </div>
                  );
                })}
              </div>
            ))}
            {detailedResults.length > 20 && (
              <div className="text-matrix-green/50">... and {detailedResults.length - 20} more records</div>
            )}
          </div>
        </details>

        <div className="text-matrix-green/60 mt-2">
          └─────────────────────────────────────────────────────────┘
        </div>
      </div>

      {/* SECTION 3: system_logs - Data Mismatch errors */}
      <div className={`border p-4 ${systemLogs.length > 0 ? 'border-warning-amber' : 'border-matrix-green'}`}>
        <div className={`mb-3 ${systemLogs.length > 0 ? 'text-warning-amber' : 'text-matrix-green'}`}>
          ┌─── system_logs: DATA INTEGRITY REPORT ───┐
        </div>

        {systemLogs.length === 0 ? (
          <div className="text-matrix-green text-sm">
            ✓ NO DATA MISMATCHES DETECTED
            <br />
            <span className="text-matrix-green/60">All cells contain valid data.</span>
          </div>
        ) : (
          <>
            <div className="text-warning-amber/80 text-xs mb-2">
              {systemLogs.length} data integrity issue(s) detected
            </div>

            <div className="max-h-48 overflow-y-auto">
              <table className="dos-table w-full text-xs">
                <thead>
                  <tr className="text-warning-amber">
                    <th>#</th>
                    <th>TYPE</th>
                    <th>MSID</th>
                    <th>FIELD</th>
                    <th>MESSAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {systemLogs.map((log) => (
                    <tr key={log.id} className="text-warning-amber/80">
                      <td>{log.id}</td>
                      <td>{log.type}</td>
                      <td>{log.msid}</td>
                      <td>{log.field}</td>
                      <td>{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className={`mt-2 ${systemLogs.length > 0 ? 'text-warning-amber/60' : 'text-matrix-green/60'}`}>
          └─────────────────────────────────────────────────────────┘
        </div>
      </div>
    </div>
  );
}
