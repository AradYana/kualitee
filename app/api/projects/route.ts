import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/projects - List all projects with latest test set info
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        kpis: {
          orderBy: { kpiNumber: 'asc' },
        },
        testSets: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
        },
        _count: {
          select: { testSets: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform to include lastRunDate and config status
    const transformedProjects = projects.map((project) => ({
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
      lastTestSet: project.testSets[0] || null,
    }));

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
    const { name, description, kpis } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Create project with KPIs in a transaction
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
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
