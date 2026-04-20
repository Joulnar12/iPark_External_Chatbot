module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const systemPrompt = `You are iPark's external AI assistant for the Talal and Madiha Zein AUB Innovation Park. Answer questions about startups, entrepreneurship, funding, and the MENA ecosystem concisely and practically.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
    if (data.error) return res.status(500).json({ error: `OpenAI: ${data.error.message}` });
    const reply = data.choices?.[0]?.message?.content || 'No response generated.';
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ error: `Server: ${err.message}` });
  }
}
