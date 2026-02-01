import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface KPI {
  id: number;
  name: string;
  description: string;
  shortName: string;
}

// Demo mode: generate realistic mock scores
function generateDemoScores(kpis: KPI[]): { kpiId: number; score: number; explanation: string }[] {
  const explanations: Record<number, string[]> = {
    5: ['Excellent quality output', 'Meets all criteria optimally', 'Outstanding performance'],
    4: ['Good quality with minor issues', 'Solid performance overall', 'Above average output'],
    3: ['Acceptable but needs improvement', 'Meets basic requirements', 'Average quality'],
    2: ['Below expectations', 'Multiple issues detected', 'Needs significant work'],
    1: ['Critical failure detected', 'Does not meet requirements', 'Major quality issues'],
  };

  return kpis.map((kpi) => {
    const weights = [0.05, 0.15, 0.35, 0.30, 0.15];
    const random = Math.random();
    let cumulative = 0;
    let score = 3;
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i];
      if (random < cumulative) {
        score = i + 1;
        break;
      }
    }
    const expArray = explanations[score];
    const explanation = expArray[Math.floor(Math.random() * expArray.length)];
    return { kpiId: kpi.id, score, explanation };
  });
}

// POST /api/testsets/[id]/evaluate - Run evaluation on a test set
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: testSetId } = await params;

    // Fetch test set with data
    const testSet = await prisma.testSet.findUnique({
      where: { id: testSetId },
      include: {
        sourceRows: true,
        targetRows: true,
      },
    });

    if (!testSet) {
      return NextResponse.json(
        { error: 'Test set not found' },
        { status: 404 }
      );
    }

    const kpis: KPI[] = JSON.parse(testSet.kpisSnapshot);

    // Build merged data
    const sourceMap = new Map(
      testSet.sourceRows.map((row) => [row.msid, JSON.parse(row.data)])
    );
    const targetMap = new Map(
      testSet.targetRows.map((row) => [row.msid, JSON.parse(row.data)])
    );

    // Find matching MSIDs
    const matchingMsids = Array.from(sourceMap.keys()).filter((msid) =>
      targetMap.has(msid)
    );

    if (matchingMsids.length === 0) {
      return NextResponse.json(
        { error: 'No matching MSIDs found between source and target' },
        { status: 400 }
      );
    }

    // Clear existing results for this test set
    await prisma.testResult.deleteMany({ where: { testSetId } });

    // DEMO MODE: Generate mock results if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[DEMO MODE] Generating mock evaluation results');
      
      const demoResults = matchingMsids.map((msid) => ({
        testSetId,
        msid,
        scores: JSON.stringify(generateDemoScores(kpis)),
      }));

      await prisma.testResult.createMany({ data: demoResults });

      return NextResponse.json({
        success: true,
        resultCount: demoResults.length,
        mode: 'demo',
      });
    }

    // Real evaluation with Anthropic API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const BATCH_SIZE = 20;
    const batches: string[][] = [];
    for (let i = 0; i < matchingMsids.length; i += BATCH_SIZE) {
      batches.push(matchingMsids.slice(i, i + BATCH_SIZE));
    }

    const allResults: { testSetId: string; msid: string; scores: string }[] = [];

    for (const batch of batches) {
      const batchPromises = batch.map(async (msid) => {
        const source = sourceMap.get(msid);
        const target = targetMap.get(msid);

        const prompt = buildEvaluationPrompt(source, target, kpis, msid);

        try {
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 500,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          });

          const responseText =
            message.content[0].type === 'text' ? message.content[0].text : '';
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              testSetId,
              msid,
              scores: JSON.stringify(parsed.scores),
            };
          }
        } catch (error) {
          console.error(`Error evaluating MSID ${msid}:`, error);
        }

        // Fallback on error
        return {
          testSetId,
          msid,
          scores: JSON.stringify(
            kpis.map((kpi) => ({
              kpiId: kpi.id,
              score: 0,
              explanation: 'Evaluation failed',
            }))
          ),
        };
      });

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
    }

    // Save all results
    await prisma.testResult.createMany({ data: allResults });

    return NextResponse.json({
      success: true,
      resultCount: allResults.length,
      mode: 'live',
    });
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { error: 'Failed to run evaluation' },
      { status: 500 }
    );
  }
}

function buildEvaluationPrompt(
  source: Record<string, string>,
  target: Record<string, string>,
  kpis: KPI[],
  msid: string
): string {
  const sourceFields = Object.entries(source)
    .filter(([key]) => key !== 'MSID')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const targetFields = Object.entries(target)
    .filter(([key]) => key !== 'MSID')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const kpiDescriptions = kpis
    .map((kpi) => `KPI ${kpi.id} - ${kpi.name}: ${kpi.description}`)
    .join('\n');

  return `You are a strict quality assurance evaluator for LLM outputs.
Evaluate the TARGET output against the SOURCE input based on the provided KPIs.
Score each KPI from 1-5:
1 = Critical Failure
2 = Poor
3 = Acceptable
4 = Good
5 = Optimal

Respond ONLY with valid JSON in this exact format (no other text):
{
  "scores": [
    {"kpiId": 1, "score": 3, "explanation": "brief explanation"},
    {"kpiId": 2, "score": 4, "explanation": "brief explanation"}
  ]
}

EVALUATION REQUEST
==================
MSID: ${msid}

SOURCE INPUT:
${sourceFields}

TARGET OUTPUT:
${targetFields}

EVALUATION CRITERIA:
${kpiDescriptions}

Evaluate the TARGET against the SOURCE based on all KPIs above.`;
}
