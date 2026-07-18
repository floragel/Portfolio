// Vercel Serverless Function for the Gemini API.
const GEMINI_MODEL = 'gemini-3.5-flash';

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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          ...(systemText && { systemInstruction: { parts: [{ text: systemText }] } }),
          contents,
          generationConfig: {
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingLevel: 'minimal' }
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Gemini request failed.'
      });
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
