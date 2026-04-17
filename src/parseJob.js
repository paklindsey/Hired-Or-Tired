const API_KEY = import.meta.env.VITE_GROQ_API_KEY
const MODEL = 'llama-3.3-70b-versatile'

export async function parseJobDescription(text) {
  const prompt = `Extract job application details from the following job description. Return ONLY a JSON object with these fields (use null for anything not found):
{
  "company": string,
  "role": string,
  "salary": string,
  "reference": string (e.g. "LinkedIn", "Indeed", "Company website" — infer from context if possible),
  "notes": string (1-2 sentence summary: team, tech stack, location, remote/hybrid, standout requirements)
}

Job description:
${text}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim()
  if (!raw) throw new Error('Empty response from Groq')
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse JSON from response')
  return JSON.parse(jsonMatch[0])
}
