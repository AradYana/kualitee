import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/testsets - List all test sets for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;

    const testSets = await prisma.testSet.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { results: true, sourceRows: true },
        },
      },
    });

    // Calculate overall scores
    const testSetsWithScores = await Promise.all(
      testSets.map(async (testSet) => {
        const results = await prisma.testResult.findMany({
          where: { testSetId: testSet.id },
        });

        let overallScore = 0;
        if (results.length > 0) {
          const allScores: number[] = [];
          results.forEach((result) => {
            const scores = JSON.parse(result.scores) as { score: number }[];
            scores.forEach((s) => {
              if (s.score > 0) allScores.push(s.score);
            });
          });
          if (allScores.length > 0) {
            overallScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
          }
        }

        return {
          id: testSet.id,
          name: testSet.name,
          createdAt: testSet.createdAt,
          resultCount: testSet._count.results,
          rowCount: testSet._count.sourceRows,
          overallScore: Math.round(overallScore * 100) / 100,
        };
      })
    );

    return NextResponse.json({ testSets: testSetsWithScores });
  } catch (error) {
    console.error('Error fetching test sets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test sets' },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/testsets - Create a new test set with data
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { name, sourceData, targetData, kpis } = body;

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { kpis: { orderBy: { kpiNumber: 'asc' } } },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Use provided KPIs or project defaults
    const kpisToUse = kpis || project.kpis.map((k) => ({
      id: k.kpiNumber,
      name: k.name,
      description: k.description,
      shortName: k.shortName,
    }));

    // Generate test set name if not provided
    const testSetCount = await prisma.testSet.count({ where: { projectId } });
    const testSetName = name || `Run #${testSetCount + 1} - ${new Date().toLocaleDateString()}`;

    // Create test set with all data in a transaction
    const testSet = await prisma.$transaction(async (tx) => {
      // Create the test set
      const newTestSet = await tx.testSet.create({
        data: {
          projectId,
          name: testSetName,
          kpisSnapshot: JSON.stringify(kpisToUse),
        },
      });

      // Insert source rows
      if (sourceData && Array.isArray(sourceData)) {
        await tx.sourceRow.createMany({
          data: sourceData.map((row: Record<string, string>) => ({
            testSetId: newTestSet.id,
            msid: row.MSID,
            data: JSON.stringify(row),
          })),
        });
      }

      // Insert target rows
      if (targetData && Array.isArray(targetData)) {
        await tx.targetRow.createMany({
          data: targetData.map((row: Record<string, string>) => ({
            testSetId: newTestSet.id,
            msid: row.MSID,
            data: JSON.stringify(row),
          })),
        });
      }

      return newTestSet;
    });

    return NextResponse.json({ testSet }, { status: 201 });
  } catch (error) {
    console.error('Error creating test set:', error);
    return NextResponse.json(
      { error: 'Failed to create test set' },
      { status: 500 }
    );
  }
}
