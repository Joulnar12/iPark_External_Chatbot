module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const SHEET_ID = '1A1ZX47YDtwENEfa6N35VgSLgT3579OHBYlhQ-ovSCeo';
  const SHEET_NAME = 'Zoho CRM Leads';

  // Get the latest user question
  const lastQuestion = messages[messages.length - 1]?.content?.toLowerCase() || '';

  let sheetContext = '';
  try {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const sheetRes = await fetch(sheetUrl);

    if (sheetRes.ok) {
      const csv = await sheetRes.text();
      const allRows = csv.split('\n').filter(r => r.trim());
      const headers = allRows[0];
      const dataRows = allRows.slice(1);
      const totalRecords = dataRows.length;

      // Parse CSV helper
      const parseRow = (row) => {
        const cols = [];
        let current = '';
        let inQuotes = false;
        for (const char of row) {
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) { cols.push(current.trim().replace(/^"|"$/g, '')); current = ''; }
          else current += char;
        }
        cols.push(current.trim().replace(/^"|"$/g, ''));
        return cols;
      };

      const headerCols = parseRow(headers);

      // Calculate global summary from ALL rows
      const industries = {};
      const leadOwners = {};
      const leadStatuses = {};
      const countries = {};
      const leadSources = {};
      let converted = 0;

      const parsedRows = dataRows.map(row => {
        const cols = parseRow(row);
        const obj = {};
        headerCols.forEach((h, i) => { obj[h] = cols[i] || ''; });
        return obj;
      });

      parsedRows.forEach(row => {
        const industry = row['Industry'] || row['industry'] || '';
        const owner = row['Lead Owner'] || row['lead owner'] || '';
        const status = row['Lead Status'] || row['lead status'] || '';
        const country = row['Country'] || row['country'] || '';
        const source = row['Lead Source'] || row['lead source'] || '';
        const isConverted = row['Is Converted'] || row['is converted'] || '';

        if (industry) industries[industry] = (industries[industry] || 0) + 1;
        if (owner) leadOwners[owner] = (leadOwners[owner] || 0) + 1;
        if (status) leadStatuses[status] = (leadStatuses[status] || 0) + 1;
        if (country) countries[country] = (countries[country] || 0) + 1;
        if (source) leadSources[source] = (leadSources[source] || 0) + 1;
        if (isConverted === 'true' || isConverted === 'TRUE') converted++;
      });

      const topIndustries = Object.entries(industries).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k,v]) => `${k}(${v})`).join(', ');
      const topOwners = Object.entries(leadOwners).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k,v]) => `${k}(${v})`).join(', ');
      const topStatuses = Object.entries(leadStatuses).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${k}(${v})`).join(', ');
      const topCountries = Object.entries(countries).sort((a,b) => b[1]-a[1]).slice(0,10).map(([k,v]) => `${k}(${v})`).join(', ');

      const globalSummary = `
IPARK ZOHO CRM LIVE SUMMARY (${totalRecords} total records):
- Industries: ${topIndustries || 'N/A'}
- Lead Owners: ${topOwners || 'N/A'}
- Lead Statuses: ${topStatuses || 'N/A'}
- Countries: ${topCountries || 'N/A'}
- Converted Leads: ${converted}
      `.trim();

      // Smart search — find relevant rows based on question keywords
      const keywords = lastQuestion
        .split(/\s+/)
        .filter(w => w.length > 3)
        .filter(w => !['what', 'how', 'many', 'does', 'have', 'show', 'tell', 'about', 'ipark', 'startup', 'startups', 'lead', 'leads'].includes(w));

      let relevantRows = [];
      if (keywords.length > 0) {
        relevantRows = parsedRows.filter(row => {
          const rowText = Object.values(row).join(' ').toLowerCase();
          return keywords.some(kw => rowText.includes(kw));
        }).slice(0, 30); // max 30 matching rows
      }

      // Build relevant rows context
      let relevantContext = '';
      if (relevantRows.length > 0) {
        const relevantCsv = [
          headerCols.join(','),
          ...relevantRows.map(row => headerCols.map(h => row[h] || '').join(','))
        ].join('\n');
        relevantContext = `\n\nRELEVANT RECORDS MATCHING YOUR QUERY:\n${relevantCsv}`;
      }

      sheetContext = globalSummary + relevantContext;
    }
  } catch (e) {
    sheetContext = 'Live data temporarily unavailable.';
  }

  const systemPrompt = `You are iPark's external AI assistant for the Talal and Madiha Zein AUB Innovation Park in Beirut, Lebanon.

You have access to live iPark startup data automatically synced from Zoho CRM. Use this data to answer any question about iPark's ecosystem accurately.

${sheetContext}

Guidelines:
- Use the live data to answer specific questions about startups, industries, lead owners, countries, and statuses
- For general entrepreneurship questions not in the data, use your knowledge about startups and the MENA ecosystem
- Keep answers concise, accurate, and helpful
- If asked about a specific person or startup, search the relevant records provided`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1000,
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
