import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/projects - List all projects with latest test set info and scores
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        kpis: {
          orderBy: { kpiNumber: 'asc' },
        },
        testSets: {
          orderBy: { createdAt: 'desc' },
          include: {
            results: true,
          },
        },
        _count: {
          select: { testSets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to include lastRunDate, config status, and calculated scores
    const transformedProjects = projects.map((project) => {
      // Calculate average scores from all test results across all test sets
      let totalScore = 0;
      let scoreCount = 0;
      const kpiScores: { [key: string]: { total: number; count: number } } = {};

      // Initialize KPI score trackers
      project.kpis.forEach((kpi) => {
        kpiScores[kpi.shortName] = { total: 0, count: 0 };
      });

      // Process all test sets and their results
      project.testSets.forEach((testSet) => {
        testSet.results.forEach((result) => {
          try {
            const scores = JSON.parse(result.scores) as Array<{
              kpiId?: string;
              kpiKey?: string;
              shortName?: string;
              score: number;
            }>;
            scores.forEach((scoreEntry) => {
              if (typeof scoreEntry.score === 'number' && !isNaN(scoreEntry.score)) {
                totalScore += scoreEntry.score;
                scoreCount++;

                // Track per-KPI scores
                const kpiKey = scoreEntry.kpiKey || scoreEntry.shortName || scoreEntry.kpiId;
                if (kpiKey && kpiScores[kpiKey]) {
                  kpiScores[kpiKey].total += scoreEntry.score;
                  kpiScores[kpiKey].count++;
                }
              }
            });
          } catch {
            // Skip invalid JSON
          }
        });
      });

      // Calculate averages
      const overallScore = scoreCount > 0 ? totalScore / scoreCount : null;
      const kpiAverages: { [key: string]: number | null } = {};
      Object.keys(kpiScores).forEach((key) => {
        kpiAverages[key] = kpiScores[key].count > 0
          ? kpiScores[key].total / kpiScores[key].count
          : null;
      });

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        siteDescription: project.siteDescription,
        targetLanguage: project.targetLanguage,
        isConfigured: project.isConfigured,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        kpis: project.kpis,
        testSetCount: project._count.testSets,
        lastTestSet: project.testSets[0] ? {
          id: project.testSets[0].id,
          name: project.testSets[0].name,
          createdAt: project.testSets[0].createdAt,
        } : null,
        // Add calculated scores
        overallScore,
        kpiAverages,
      };
    });

    return NextResponse.json({ projects: transformedProjects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project with default KPIs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, siteDescription, kpis } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    if (!siteDescription?.trim()) {
      return NextResponse.json(
        { error: 'Prompt/Agent context is required' },
        { status: 400 }
      );
    }

    // Create project with KPIs in a transaction
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        siteDescription: siteDescription.trim(),
        kpis: {
          create: kpis?.map((kpi: { name: string; description: string; shortName: string }, index: number) => ({
            kpiNumber: index + 1,
            name: kpi.name,
            description: kpi.description,
            shortName: kpi.shortName || kpi.name.slice(0, 10).toUpperCase(),
          })) || [],
        },
      },
      include: {
        kpis: {
          orderBy: { kpiNumber: 'asc' },
        },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
