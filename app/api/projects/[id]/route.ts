import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id] - Get a single project with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        kpis: {
          orderBy: { kpiNumber: 'asc' },
        },
        testSets: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            _count: {
              select: { results: true },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Calculate overall scores for each test set
    const testSetsWithScores = await Promise.all(
      project.testSets.map(async (testSet) => {
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
          overallScore: Math.round(overallScore * 100) / 100,
        };
      })
    );

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        siteDescription: project.siteDescription,
        targetLanguage: project.targetLanguage,
        isConfigured: project.isConfigured,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        kpis: project.kpis,
        testSets: testSetsWithScores,
      },
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - Update a project and its KPIs
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, siteDescription, targetLanguage, kpis, markAsConfigured } = body;

    // Check if project exists
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Update project and KPIs in a transaction
    const project = await prisma.$transaction(async (tx) => {
      // Build update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (siteDescription !== undefined) updateData.siteDescription = siteDescription?.trim() || null;
      if (targetLanguage !== undefined) updateData.targetLanguage = targetLanguage?.trim() || null;
      if (markAsConfigured) updateData.isConfigured = true;

      // Update project details
      const updatedProject = await tx.project.update({
        where: { id },
        data: updateData,
      });

      // If KPIs are provided, update them
      if (kpis && Array.isArray(kpis)) {
        // Delete existing KPIs
        await tx.projectKPI.deleteMany({ where: { projectId: id } });

        // Create new KPIs (filter out empty ones)
        const validKPIs = kpis.filter((kpi: { name: string; description: string }) => 
          kpi.name?.trim() && kpi.description?.trim()
        );
        
        if (validKPIs.length > 0) {
          await tx.projectKPI.createMany({
            data: validKPIs.map((kpi: { name: string; description: string; shortName: string }, index: number) => ({
              projectId: id,
              kpiNumber: index + 1,
              name: kpi.name.trim(),
              description: kpi.description.trim(),
              shortName: kpi.shortName?.trim() || kpi.name.slice(0, 10).toUpperCase(),
            })),
          });
        }
      }

      return updatedProject;
    });

    // Fetch updated project with KPIs
    const fullProject = await prisma.project.findUnique({
      where: { id },
      include: {
        kpis: {
          orderBy: { kpiNumber: 'asc' },
        },
      },
    });

    return NextResponse.json({ project: fullProject });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project and all related data
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if project exists
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Delete project (cascade will delete KPIs, TestSets, and all related data)
    await prisma.project.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
