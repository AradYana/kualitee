'use client';

import { useAppStore } from '@/lib/store';

interface ResultsDisplayProps {
  filterFailures?: boolean;
}

export default function ResultsDisplay({ filterFailures = false }: ResultsDisplayProps) {
  const { evaluationResults, evaluationSummary, kpis, dataMismatchLog } = useAppStore();

  if (!evaluationSummary || !evaluationResults) {
    return null;
  }

  // Filter results if showing only failures
  const displayResults = filterFailures
    ? evaluationResults.filter((result) =>
        result.scores.some((score) => score.score < 3)
      )
    : evaluationResults;

  // Generate executive summary
  const overallAverage =
    evaluationSummary.reduce((acc, s) => acc + s.averageScore, 0) /
    evaluationSummary.length;

  const getStatusIndicator = (score: number) => {
    if (score >= 4.5) return { text: 'OPTIMAL', color: 'text-matrix-green' };
    if (score >= 3.5) return { text: 'ACCEPTABLE', color: 'text-matrix-green/80' };
    if (score >= 2.5) return { text: 'MARGINAL', color: 'text-warning-amber' };
    return { text: 'CRITICAL', color: 'text-error-red' };
  };

  const status = getStatusIndicator(overallAverage);

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="border border-matrix-green p-4">
        <div className="text-matrix-green mb-3">
          ╔═══════════════════════════════════════════════════════╗
          <br />
          ║&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;EXECUTIVE SUMMARY&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;║
          <br />
          ╚═══════════════════════════════════════════════════════╝
        </div>

        <div className="font-mono text-sm space-y-2">
          <div>
            EVALUATION COMPLETE. TOTAL RECORDS PROCESSED: {evaluationResults.length}
          </div>
          <div>
            OVERALL SYSTEM STATUS:{' '}
            <span className={status.color}>[{status.text}]</span>
          </div>
          <div>
            AGGREGATE QUALITY INDEX: {overallAverage.toFixed(2)} / 5.00
          </div>
          <div className="text-matrix-green/60 mt-3">
            ───────────────────────────────────────────────────────
          </div>
          <div className="text-matrix-green/80">
            {overallAverage >= 4 &&
              'System output demonstrates high quality metrics across all KPIs. Minimal intervention required.'}
            {overallAverage >= 3 &&
              overallAverage < 4 &&
              'System output meets acceptable thresholds. Review flagged items for optimization opportunities.'}
            {overallAverage >= 2 &&
              overallAverage < 3 &&
              'System output shows inconsistencies. Recommend targeted review of low-scoring segments.'}
            {overallAverage < 2 &&
              'ALERT: System output below acceptable thresholds. Immediate review and recalibration advised.'}
          </div>
        </div>
      </div>

      {/* KPI Summary Table */}
      <div className="border border-matrix-green p-4">
        <div className="text-matrix-green mb-3">
          ┌─── KPI PERFORMANCE MATRIX ───┐
        </div>

        <table className="dos-table w-full text-sm">
          <thead>
            <tr>
              <th>KPI</th>
              <th>AVG SCORE</th>
              <th>SHORT EXPLANATION</th>
            </tr>
          </thead>
          <tbody>
            {evaluationSummary.map((summary) => {
              const kpiStatus = getStatusIndicator(summary.averageScore);
              return (
                <tr key={summary.kpiId}>
                  <td>
                    [{summary.shortName}] {summary.kpiName}
                  </td>
                  <td className={kpiStatus.color}>
                    {summary.averageScore.toFixed(2)}
                  </td>
                  <td className="text-matrix-green/80">
                    {summary.shortExplanation}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="text-matrix-green/60 mt-2">
          └─────────────────────────────────────────────────────────┘
        </div>
      </div>

      {/* Detailed Results Table */}
      <div className="border border-matrix-green p-4">
        <div className="text-matrix-green mb-3">
          ┌─── DETAILED EVALUATION LOG {filterFailures && '(FAILURES ONLY)'} ───┐
        </div>

        <div className="max-h-96 overflow-y-auto">
          <table className="dos-table w-full text-xs">
            <thead className="sticky top-0 bg-dos-black">
              <tr>
                <th>MSID</th>
                {kpis.map((kpi) => (
                  <th key={kpi.id}>{kpi.shortName || `KPI${kpi.id}`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayResults.map((result) => (
                <tr key={result.msid}>
                  <td>{result.msid}</td>
                  {result.scores.map((score) => {
                    const scoreStatus = getStatusIndicator(score.score);
                    return (
                      <td
                        key={score.kpiId}
                        className={scoreStatus.color}
                        title={score.explanation}
                      >
                        {score.score}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-matrix-green/60 mt-2">
          └─────────────────────────────────────────────────────────┘
        </div>
      </div>

      {/* Data Mismatch Log */}
      {dataMismatchLog.length > 0 && (
        <div className="border border-warning-amber p-4">
          <div className="text-warning-amber mb-3">
            ┌─── SYSTEM_LOG_DUMP: DATA MISMATCHES ───┐
          </div>

          <div className="max-h-48 overflow-y-auto">
            {dataMismatchLog.map((mismatch, index) => (
              <div key={index} className="text-warning-amber/80 text-sm">
                [WARNING] MSID: {mismatch.msid} | FIELD: {mismatch.field} | STATUS: EMPTY CELL
              </div>
            ))}
          </div>

          <div className="text-warning-amber/60 mt-2">
            └─────────────────────────────────────────────────────────┘
          </div>
        </div>
      )}
    </div>
  );
}
