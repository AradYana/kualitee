import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { EvaluationResult, KPI, EvaluationSummary } from '@/lib/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SummaryRequest {
  results: EvaluationResult[];
  kpis: KPI[];
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

    // Generate short explanations using LLM
    if (process.env.OPENAI_API_KEY) {
      const prompt = `
Based on these KPI evaluation results, provide a brief 1-sentence explanation for each:

${summaries.map((s) => `${s.kpiName} (${s.shortName}): Average Score ${s.averageScore.toFixed(2)}/5`).join('\n')}

KPI Definitions:
${kpis.map((k) => `${k.name}: ${k.description}`).join('\n')}

Respond with JSON array of explanations:
[
  {"kpiId": 1, "explanation": "brief explanation"},
  {"kpiId": 2, "explanation": "brief explanation"},
  ...
]
`;

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Generate brief, terminal-style explanations for KPI performance. Be concise and technical.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 500,
        });

        const responseText = completion.choices[0]?.message?.content || '';
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
