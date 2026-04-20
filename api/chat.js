export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  const systemPrompt = `You are iPark's external AI assistant — a knowledgeable, friendly advisor for startup founders, students, investors, and visitors of the Talal and Madiha Zein AUB Innovation Park in Beirut, Lebanon.

You specialize in:
- Startup ideation, validation, and growth
- Entrepreneurship best practices
- Funding, investment, and venture capital
- Tech industry trends and innovation
- MENA startup ecosystem insights
- Business models, go-to-market strategies
- Leadership, team building, and product development

Keep answers concise, practical, and encouraging. Use clear language. When relevant, reference the MENA/Lebanon context.
Do not discuss internal iPark operations, confidential data, or internal roadmap details.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 800,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10)
        ]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
