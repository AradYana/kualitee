import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Generate demo response based on query
function generateDemoResponse(query: string, evaluationResults: any[], kpis: any[]): string {
  const lowerQuery = query.toLowerCase();
  
  // Calculate stats
  const totalRecords = evaluationResults.length;
  const avgScores: Record<number, number> = {};
  kpis.forEach((kpi: any) => {
    const scores = evaluationResults
      .flatMap((r: any) => r.scores.filter((s: any) => s.kpiId === kpi.id))
      .map((s: any) => s.score);
    avgScores[kpi.id] = scores.length > 0 
      ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length 
      : 0;
  });
  
  // Check for common query patterns
  if (lowerQuery.includes('< 3') || lowerQuery.includes('below') || lowerQuery.includes('failure')) {
    const failingMsids = evaluationResults
      .filter((r: any) => r.scores.some((s: any) => s.score < 3))
      .slice(0, 5)
      .map((r: any) => r.msid);
    return `[DEMO MODE] Found ${failingMsids.length} records with scores below 3:\n\n${failingMsids.map((id: string) => `• MSID: ${id}`).join('\n')}\n\nNote: This is simulated demo data.`;
  }
  
  if (lowerQuery.includes('average') || lowerQuery.includes('summary') || lowerQuery.includes('overall')) {
    const statsLines = kpis.map((kpi: any) => 
      `• ${kpi.name} (${kpi.shortName}): ${avgScores[kpi.id].toFixed(2)}/5`
    ).join('\n');
    return `[DEMO MODE] Overall Statistics:\n\nTotal Records: ${totalRecords}\n\n${statsLines}\n\nNote: This is simulated demo data.`;
  }
  
  if (lowerQuery.includes('common') || lowerQuery.includes('reason') || lowerQuery.includes('why')) {
    return `[DEMO MODE] Common patterns observed:\n\n• Inconsistent formatting in 23% of outputs\n• Missing context references in 15% of cases\n• Tone variations detected in 12% of responses\n\nNote: This is simulated demo data for demonstration purposes.`;
  }
  
  // Default response
  return `[DEMO MODE] Query received: "${query}"\n\nAnalysis based on ${totalRecords} evaluated records across ${kpis.length} KPIs.\n\nTo get real AI-powered analysis, configure your ANTHROPIC_API_KEY environment variable.\n\nNote: This is a demo response. The full version would provide detailed insights based on your actual data.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, evaluationResults, kpis } = body;

    // DEMO MODE: Return mock response if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[DEMO MODE] Generating mock query response');
      const demoResponse = generateDemoResponse(query, evaluationResults || [], kpis || []);
      return NextResponse.json({ response: demoResponse });
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
