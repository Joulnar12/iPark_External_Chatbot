module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const SHEET_ID = '1A1ZX47YDtwENEfa6N35VgSLgT3579OHBYlhQ-ovSCeo';
  const SHEET_NAME = 'Zoho CRM Leads';

  const lastQuestion = messages[messages.length - 1]?.content?.toLowerCase() || '';

  const KEY_COLUMNS = [
    'First Name',
    'Last Name',
    'Lead Name',
    'Organization/Company/Startup',
    'Email',
    'Lead Source',
    'Lead Status',
    'Industry - a',
    'AUB Affiliation -a',
    'Provide a brief overview of your solution -a',
    'Country Of Residence',
    'Startup Stage',
    'Cohort',
    'Generating revenue - a',
    'Team Size',
    'Female Founders',
    'Investment Ask',
    'Investment Ready',
    'Startup AUB Affiliation',
    'Mentors Referred',
    'Target Market - a',
    'Business Model Type -a',
    'Active / Inactive',
    'Faculty',
    'Is Converted',
    'Lead Owner',
    'Number of co-founders -a',
    'Job Title',
    'Startup Registration Location -a',
    'Track',
    'Program',
    'Latest involvement',
    'Startup Name - a',
  ];

  let sheetContext = '';
  try {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const sheetRes = await fetch(sheetUrl);

    if (sheetRes.ok) {
      const csv = await sheetRes.text();
      const allRows = csv.split('\n').filter(r => r.trim());
      const headers = allRows[1];
      const dataRows = allRows.slice(2);
      const totalRecords = dataRows.length;

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

      const industries = {};
      const leadOwners = {};
      const leadStatuses = {};
      const countries = {};
      const stages = {};
      const cohorts = {};
      const tracks = {};
      const programs = {};
      let converted = 0;
      let revenueGenerating = 0;
      let femaleFounders = 0;

      const parsedRows = dataRows.map(row => {
        const cols = parseRow(row);
        const obj = {};
        headerCols.forEach((h, i) => { obj[h] = cols[i] || ''; });
        obj._searchText = Object.values(obj).join(' ').toLowerCase();
        return obj;
      });

      parsedRows.forEach(row => {
        // Using YOUR verified column names
        const industry = row['Industry - a'] || '';
        const owner = row['Lead Owner'] || '';
        const status = row['Lead Status'] || '';
        const country = row['Country Of Residence'] || '';
        const stage = row['Startup Stage'] || '';
        const cohort = row['Cohort'] || '';
        const revenue = row['Generating revenue - a'] || '';
        const isConverted = row['Is Converted'] || '';
        const track = row['Track'] || '';
        const program = row['Program'] || '';
        const female = row['Female Founders'] || '';

        if (industry) industries[industry] = (industries[industry] || 0) + 1;
        if (owner) leadOwners[owner] = (leadOwners[owner] || 0) + 1;
        if (status) leadStatuses[status] = (leadStatuses[status] || 0) + 1;
        if (country) countries[country] = (countries[country] || 0) + 1;
        if (stage) stages[stage] = (stages[stage] || 0) + 1;
        if (cohort) cohorts[cohort] = (cohorts[cohort] || 0) + 1;
        if (track) tracks[track] = (tracks[track] || 0) + 1;
        if (program) programs[program] = (programs[program] || 0) + 1;
        if (isConverted === 'true' || isConverted === 'TRUE') converted++;
        if (revenue === 'true' || revenue === 'TRUE' || revenue === 'Yes' || revenue === 'yes' || revenue === '1') revenueGenerating++;
        if (female === 'true' || female === 'TRUE' || female === 'Yes' || female === 'yes' || female === '1') femaleFounders++;
      });

      const fmt = (obj, limit = 10) =>
        Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0, limit).map(([k,v]) => `${k}(${v})`).join(', ');

      const globalSummary = `
IPARK ZOHO CRM LIVE SUMMARY (${totalRecords} total records):
- Industries: ${fmt(industries) || 'N/A'}
- Lead Owners: ${fmt(leadOwners) || 'N/A'}
- Lead Statuses: ${fmt(leadStatuses, 20) || 'N/A'}
- Countries of Residence: ${fmt(countries) || 'N/A'}
- Startup Stages: ${fmt(stages) || 'N/A'}
- Cohorts: ${fmt(cohorts, 20) || 'N/A'}
- Tracks: ${fmt(tracks) || 'N/A'}
- Programs: ${fmt(programs) || 'N/A'}
- Converted Leads: ${converted}
- Revenue-Generating Startups: ${revenueGenerating}
- Startups with Female Founders: ${femaleFounders}
      `.trim();

      const stopWords = new Set([
        'what', 'how', 'many', 'does', 'have', 'show', 'tell', 'about',
        'ipark', 'startup', 'startups', 'lead', 'leads', 'list', 'give',
        'find', 'which', 'that', 'with', 'from', 'this', 'there', 'their',
        'are', 'the', 'and', 'for', 'you', 'can', 'all', 'names', 'name'
      ]);

      const keywords = lastQuestion
        .split(/\s+/)
        .map(w => w.replace(/[^a-z0-9]/g, ''))
        .filter(w => w.length > 2)
        .filter(w => !stopWords.has(w));

      let relevantRows = [];
      if (keywords.length > 0) {
        relevantRows = parsedRows.filter(row =>
          keywords.some(kw => row._searchText.includes(kw))
        ).slice(0, 30);
      }

      let relevantContext = '';
      if (relevantRows.length > 0) {
        const availableCols = KEY_COLUMNS.filter(col => headerCols.includes(col));
        const relevantCsv = [
          availableCols.join(','),
          ...relevantRows.map(row =>
            availableCols.map(h => {
              const val = row[h] || '';
              return val.includes(',') ? `"${val}"` : val;
            }).join(',')
          )
        ].join('\n');
        relevantContext = `\n\nRELEVANT RECORDS MATCHING YOUR QUERY (${relevantRows.length} found):\n${relevantCsv}`;
      }

      sheetContext = globalSummary + relevantContext;
    }
  } catch (e) {
    sheetContext = 'Live data temporarily unavailable.';
  }

  const systemPrompt = `You are iPark's intelligent CRM data assistant for the Talal and Madiha Zein AUB Innovation Park in Beirut, Lebanon.

You have direct access to iPark's live Zoho CRM database, synced in real time to a Google Sheet. Treat every question as a data query — be precise, structured, and data-driven in your answers.

${sheetContext}

Guidelines:
- Answer like a database analyst: give exact numbers, lists, and breakdowns whenever possible
- Always cite which fields and filters you used to reach your answer (e.g. "Based on the Startup Stage and Country Of Residence fields...")
- When listing startups or people, always show: Lead Name, Startup Name - a, Organization/Company/Startup, Startup Stage, Country Of Residence, and any other relevant fields
- If a question requires data not in the summary or matched records, say so explicitly and suggest how to refine the query
- For multi-filter questions, apply all filters you can and state clearly what you filtered on
- Keep answers structured — use bullet points or tables for lists of records
- Do not make up data — if it's not in the provided records, say it's not available in the current query results`;

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
