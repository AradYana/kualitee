import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/testsets/[id] - Get a test set with all data and results
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const testSet = await prisma.testSet.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        sourceRows: true,
        targetRows: true,
        results: true,
        dataMismatches: true,
      },
    });

    if (!testSet) {
      return NextResponse.json(
        { error: 'Test set not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const kpis = JSON.parse(testSet.kpisSnapshot);
    const sourceData = testSet.sourceRows.map((row) => JSON.parse(row.data));
    const targetData = testSet.targetRows.map((row) => JSON.parse(row.data));
    const evaluationResults = testSet.results.map((result) => ({
      msid: result.msid,
      scores: JSON.parse(result.scores),
    }));

    // Calculate summary statistics
    const summaryStats = kpis.map((kpi: { id: number; name: string; shortName: string }) => {
      const scores = evaluationResults
        .flatMap((r) => r.scores.filter((s: { kpiId: number }) => s.kpiId === kpi.id))
        .map((s: { score: number }) => s.score)
        .filter((s: number) => s > 0);

      const mean = scores.length > 0
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
        : 0;

      const sorted = [...scores].sort((a, b) => a - b);
      const median = sorted.length > 0
        ? sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]
        : 0;

      return {
        kpiId: kpi.id,
        kpiName: kpi.name,
        shortName: kpi.shortName,
        mean: Math.round(mean * 100) / 100,
        median: Math.round(median * 100) / 100,
        count: scores.length,
      };
    });

    return NextResponse.json({
      testSet: {
        id: testSet.id,
        name: testSet.name,
        createdAt: testSet.createdAt,
        project: testSet.project,
        kpis,
        sourceData,
        targetData,
        evaluationResults,
        summaryStats,
        dataMismatches: testSet.dataMismatches,
      },
    });
  } catch (error) {
    console.error('Error fetching test set:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test set' },
      { status: 500 }
    );
  }
}

// DELETE /api/testsets/[id] - Delete a test set
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const existing = await prisma.testSet.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Test set not found' },
        { status: 404 }
      );
    }

    await prisma.testSet.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting test set:', error);
    return NextResponse.json(
      { error: 'Failed to delete test set' },
      { status: 500 }
    );
  }
}
