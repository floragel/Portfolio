// Vercel Serverless Function for the Gemini API.
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash'
];

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'A non-empty messages array is required.' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set on the server.' });
  }

  const systemText = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');

  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(message.content || '') }]
    }));

  try {
    const requestBody = JSON.stringify({
      ...(systemText && { systemInstruction: { parts: [{ text: systemText }] } }),
      contents,
      generationConfig: {
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingLevel: 'minimal' }
      }
    });

    let data;
    let lastStatus = 503;
    let lastError = 'Gemini is temporarily unavailable.';

    for (const model of GEMINI_MODELS) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: requestBody
        }
      );

      data = await response.json().catch(() => ({}));

      if (response.ok) break;

      lastStatus = response.status;
      lastError = data.error?.message || `Gemini model ${model} failed.`;
      console.warn(`Gemini model ${model} failed with ${response.status}.`);

      if (!RETRYABLE_STATUSES.has(response.status) && response.status !== 404) {
        return res.status(response.status).json({ error: lastError });
      }

      data = null;
    }

    if (!data) {
      return res.status(lastStatus).json({ error: lastError });
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Gemini returned an empty response.' });
    }

    // Preserve the response shape expected by the existing chat interface.
    return res.status(200).json({
      choices: [{ message: { role: 'assistant', content: text } }]
    });
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
