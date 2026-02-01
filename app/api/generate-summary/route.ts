import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { EvaluationResult, KPI, EvaluationSummary } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface SummaryRequest {
  results: EvaluationResult[];
  kpis: KPI[];
}

// Generate fallback explanations based on score
function getExplanationForScore(average: number): string {
  if (average >= 4) {
    return 'Performance meets optimal standards. Quality targets achieved.';
  } else if (average >= 3) {
    return 'Acceptable performance with room for improvement.';
  } else if (average >= 2) {
    return 'Below threshold. Review and remediation recommended.';
  } else {
    return 'Critical issues detected. Immediate attention required.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SummaryRequest = await request.json();
    const { results, kpis } = body;

    // Calculate averages for each KPI
    const summaries: EvaluationSummary[] = kpis.map((kpi) => {
      const scores = results
        .map((r) => r.scores.find((s) => s.kpiId === kpi.id)?.score || 0)
        .filter((s) => s > 0);

      const average = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      return {
        kpiId: kpi.id,
        kpiName: kpi.name,
        shortName: kpi.shortName,
        averageScore: average,
        shortExplanation: '',
      };
    });

    // DEMO MODE: Use fallback explanations if no API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('[DEMO MODE] Generating fallback summary explanations');
      summaries.forEach((s) => {
        s.shortExplanation = getExplanationForScore(s.averageScore);
      });
      return NextResponse.json({ summaries });
    }

    // Generate short explanations using Claude
    if (process.env.ANTHROPIC_API_KEY) {
      const prompt = `
Based on these KPI evaluation results, provide a brief 1-sentence explanation for each:

${summaries.map((s) => `${s.kpiName} (${s.shortName}): Average Score ${s.averageScore.toFixed(2)}/5`).join('\n')}

KPI Definitions:
${kpis.map((k) => `${k.name}: ${k.description}`).join('\n')}

Respond with ONLY a JSON array of explanations (no other text):
[
  {"kpiId": 1, "explanation": "brief explanation"},
  {"kpiId": 2, "explanation": "brief explanation"}
]
`;

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Generate brief, terminal-style explanations for KPI performance. Be concise and technical.\n\n${prompt}`,
            },
          ],
        });

        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const explanations = JSON.parse(jsonMatch[0]);
          explanations.forEach((exp: { kpiId: number; explanation: string }) => {
            const summary = summaries.find((s) => s.kpiId === exp.kpiId);
            if (summary) {
              summary.shortExplanation = exp.explanation;
            }
          });
        }
      } catch (error) {
        console.error('Failed to generate explanations:', error);
        // Fall back to generic explanations
        summaries.forEach((s) => {
          if (s.averageScore >= 4) {
            s.shortExplanation = 'Performance meets optimal standards.';
          } else if (s.averageScore >= 3) {
            s.shortExplanation = 'Acceptable performance with room for improvement.';
          } else if (s.averageScore >= 2) {
            s.shortExplanation = 'Below threshold. Review recommended.';
          } else {
            s.shortExplanation = 'Critical issues detected. Immediate attention required.';
          }
        });
      }
    }

    return NextResponse.json({ summaries });
  } catch (error) {
    console.error('Summary generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
}
