module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
  const SHEET_ID = '1A1ZX47YDtwENEfa6N35VgSLgT3579OHBYlhQ-ovSCeo';
  const SHEET_NAME = 'Zoho CRM Leads'; 
  // ──────────────────────────────────────────────

  let sheetContext = '';
  try {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const sheetRes = await fetch(sheetUrl);
    if (sheetRes.ok) {
      const csv = await sheetRes.text();
      const rows = csv.split('\n').slice(0, 50); // first 50 rows
      sheetContext = `LIVE iPARK DATA FROM ZOHO CRM:\n${rows.join('\n')}`;
    }
  } catch (e) {
    sheetContext = 'Live data temporarily unavailable.';
  }

  const systemPrompt = `You are iPark's external AI assistant for the Talal and Madiha Zein AUB Innovation Park in Beirut, Lebanon.

You have access to live iPark startup data from Zoho CRM. Use this data to answer specific questions about iPark's ecosystem, startups, industries, and programs.

${sheetContext}

For questions not covered by the data, use your general knowledge about startups, entrepreneurship, funding, and the MENA ecosystem.

Keep answers concise, practical, and encouraging.`;

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
