import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, evaluationResults, kpis } = body;

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Add ANTHROPIC_API_KEY to .env.local' },
        { status: 500 }
      );
    }

    // Build context from evaluation results
    const resultsContext = evaluationResults
      .slice(0, 50) // Limit to first 50 for context size
      .map((result: any) => {
        const scores = result.scores
          .map((s: any) => `KPI_${s.kpiId}: ${s.score}/5 (${s.explanation})`)
          .join(', ');
        return `MSID ${result.msid}: ${scores}`;
      })
      .join('\n');

    const kpiContext = kpis
      .map((kpi: any) => `KPI_${kpi.id} (${kpi.shortName}): ${kpi.name} - ${kpi.description}`)
      .join('\n');

    // Calculate some statistics for context
    const avgScores: Record<number, number> = {};
    kpis.forEach((kpi: any) => {
      const scores = evaluationResults
        .flatMap((r: any) => r.scores.filter((s: any) => s.kpiId === kpi.id))
        .map((s: any) => s.score);
      avgScores[kpi.id] = scores.length > 0 
        ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length 
        : 0;
    });

    const statsContext = kpis
      .map((kpi: any) => `KPI_${kpi.id} Average: ${avgScores[kpi.id].toFixed(2)}`)
      .join(', ');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `You are KUALITEE, an AI assistant for analyzing LLM evaluation results.
You have access to evaluation data and can answer questions about it.
Respond in a concise, terminal-style format. Use plain text, no markdown.
When listing results, format them clearly with MSIDs and scores.

AVAILABLE DATA:
- ${evaluationResults.length} total evaluated records
- ${kpis.length} KPIs defined
- Statistics: ${statsContext}

KPI DEFINITIONS:
${kpiContext}

SAMPLE EVALUATION RESULTS:
${resultsContext}

Answer the user's question based on this data. If asked to filter or find specific MSIDs, search through the results and list matching ones.

USER QUESTION: ${query}`,
        },
      ],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : 'No response generated';

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Query API error:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
