import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { DataRow, KPI, EvaluationResponse } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface EvaluationBatchRequest {
  batch: {
    source: DataRow;
    target: DataRow;
  }[];
  kpis: KPI[];
}

export async function POST(request: NextRequest) {
  try {
    const body: EvaluationBatchRequest = await request.json();
    const { batch, kpis } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    // Process batch in parallel using Promise.all
    const evaluationPromises = batch.map(async ({ source, target }) => {
      const msid = source.MSID;

      // Build the evaluation prompt
      const prompt = buildEvaluationPrompt(source, target, kpis);

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `You are a strict quality assurance evaluator for LLM outputs. 
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

${prompt}`,
            },
          ],
        });

        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        
        // Parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Invalid JSON response from LLM');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        return {
          msid,
          scores: parsed.scores,
        } as EvaluationResponse;
      } catch (error) {
        console.error(`Error evaluating MSID ${msid}:`, error);
        // Return default scores on error
        return {
          msid,
          scores: kpis.map((kpi) => ({
            kpiId: kpi.id,
            score: 0,
            explanation: 'Evaluation failed',
          })),
        } as EvaluationResponse;
      }
    });

    const results = await Promise.all(evaluationPromises);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Evaluation API error:', error);
    return NextResponse.json(
      { error: 'Failed to process evaluation' },
      { status: 500 }
    );
  }
}

function buildEvaluationPrompt(source: DataRow, target: DataRow, kpis: KPI[]): string {
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

  return `
EVALUATION REQUEST
==================
MSID: ${source.MSID}

SOURCE INPUT:
${sourceFields}

TARGET OUTPUT:
${targetFields}

EVALUATION CRITERIA:
${kpiDescriptions}

Evaluate the TARGET against the SOURCE based on all KPIs above. Provide scores (1-5) and brief explanations.
`;
}

// Endpoint for re-evaluating a single MSID with user feedback
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { source, target, kpis, msid, userFeedback } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 }
      );
    }

    const prompt = buildEvaluationPrompt(source, target, kpis);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are a strict quality assurance evaluator for LLM outputs.
The user has provided feedback indicating your previous evaluation may have been incorrect.
Re-evaluate carefully, taking their feedback into account.

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

${prompt}

USER FEEDBACK FOR RECONSIDERATION:
${userFeedback}`,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from LLM');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      msid,
      scores: parsed.scores,
    });
  } catch (error) {
    console.error('Re-evaluation API error:', error);
    return NextResponse.json(
      { error: 'Failed to process re-evaluation' },
      { status: 500 }
    );
  }
}
