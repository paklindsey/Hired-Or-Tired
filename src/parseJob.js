const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = 'gemini-1.5-flash'

function makeUrl() {
  // OAuth2 access tokens (AQ. prefix) use Bearer auth; API keys (AIza prefix) use ?key=
  const isOAuth = API_KEY?.startsWith('AQ.') || API_KEY?.startsWith('ya29.')
  const base = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
  return isOAuth ? base : `${base}?key=${API_KEY}`
}

export async function parseJobDescription(text) {
  const isOAuth = API_KEY?.startsWith('AQ.') || API_KEY?.startsWith('ya29.')
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

  const res = await fetch(makeUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(isOAuth && { Authorization: `Bearer ${API_KEY}` }),
    },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!raw) throw new Error('Empty response from Gemini')
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse JSON from response')
  return JSON.parse(jsonMatch[0])
}
