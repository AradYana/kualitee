import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { DataRow, KPI, EvaluationResponse } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Process batch in parallel using Promise.all
    const evaluationPromises = batch.map(async ({ source, target }) => {
      const msid = source.MSID;

      // Build the evaluation prompt
      const prompt = buildEvaluationPrompt(source, target, kpis);

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a strict quality assurance evaluator for LLM outputs. 
              Evaluate the TARGET output against the SOURCE input based on the provided KPIs.
              Score each KPI from 1-5:
              1 = Critical Failure
              2 = Poor
              3 = Acceptable  
              4 = Good
              5 = Optimal
              
              Respond ONLY with valid JSON in this exact format:
              {
                "scores": [
                  {"kpiId": 1, "score": 3, "explanation": "brief explanation"},
                  {"kpiId": 2, "score": 4, "explanation": "brief explanation"},
                  {"kpiId": 3, "score": 2, "explanation": "brief explanation"},
                  {"kpiId": 4, "score": 5, "explanation": "brief explanation"}
                ]
              }`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        });

        const responseText = completion.choices[0]?.message?.content || '';
        
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const prompt = buildEvaluationPrompt(source, target, kpis);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a strict quality assurance evaluator for LLM outputs.
          The user has provided feedback indicating your previous evaluation may have been incorrect.
          Re-evaluate carefully, taking their feedback into account.
          
          Score each KPI from 1-5:
          1 = Critical Failure
          2 = Poor
          3 = Acceptable  
          4 = Good
          5 = Optimal
          
          Respond ONLY with valid JSON in this exact format:
          {
            "scores": [
              {"kpiId": 1, "score": 3, "explanation": "brief explanation"},
              {"kpiId": 2, "score": 4, "explanation": "brief explanation"},
              {"kpiId": 3, "score": 2, "explanation": "brief explanation"},
              {"kpiId": 4, "score": 5, "explanation": "brief explanation"}
            ]
          }`,
        },
        {
          role: 'user',
          content: `${prompt}\n\nUSER FEEDBACK FOR RECONSIDERATION:\n${userFeedback}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const responseText = completion.choices[0]?.message?.content || '';
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
