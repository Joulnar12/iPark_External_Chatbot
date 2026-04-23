# iPark External AI Chatbot

**Project:** MSBA Capstone — Talal and Madiha Zein AUB Innovation Park  
**Stack:** Node.js · OpenAI GPT-4o · Google Sheets (Zoho CRM sync) · Vercel  
**Live URL:** i-park-external-chatbot.vercel.app  
**GitHub:** github.com/Joulnar12/iPark_External_Chatbot

---

## What This Bot Does

The iPark External Chatbot is an AI-powered CRM data assistant that answers questions about iPark's startup ecosystem. It pulls **live, real-time data** from a Google Sheet automatically synced from Zoho CRM, then uses OpenAI GPT-4o to generate precise, data-driven answers.

Every time a user sends a message, the bot:
1. Fetches the latest TSV data from the correct Google Sheet tab (gid=490775383)
2. Parses tab-separated rows — Row 1 is the title, Row 2 is headers, Row 3+ is data
3. Builds a full statistical summary from all records (industries, countries, stages, cohorts, etc.)
4. Runs a case-insensitive keyword search to find the most relevant rows
5. Sends the summary + relevant rows to GPT-4o
6. Returns a structured, analyst-style answer

---

## Project Structure

```
/
├── index.html          # Frontend chat UI (iPark branded)
├── api/
│   └── chat.js         # Serverless backend — TSV fetching, parsing, GPT call
├── vercel.json         # Routing + iframe embedding headers
└── package.json        # No "type":"module" — uses CommonJS
```

---

## Environment Variables (Vercel)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key (GPT-4o access required) |

Set in: Vercel Dashboard → Project → Settings → Environment Variables

---

## Data Source

| Field | Value |
|---|---|
| Google Sheet ID | `1A1ZX47YDtwENEfa6N35VgSLgT3579OHBYlhQ-ovSCeo` |
| Sheet Tab GID | `490775383` |
| Sync Method | Zoho CRM → Google Sheets auto-sync |
| Access | Public ("Anyone with the link can view") |
| Fetch Method | Google Sheets export as TSV (`export?format=tsv&gid=490775383`) |
| Total Records | ~2,168 rows (as of April 2026) |

### Important Sheet Structure
- **Row 1:** Title row ("Zoho CRM Import / Last updated...")
- **Row 2:** Column headers (`Record Id`, `First Name`, `Industry - a`, etc.)
- **Row 3+:** Data rows

The fetch URL uses `format=tsv` (tab-separated) and the specific `gid` — NOT the sheet name. This is critical because the sheet exports as TSV, not CSV.

---

## How the Data Pipeline Works

### Step 1 — Fetch & Parse (TSV)
The sheet is fetched using Google's export endpoint with `format=tsv&gid=490775383`. Each row is split by tab character (`\t`). Row 1 (title) is skipped, Row 2 becomes the header map, Row 3+ are data rows.

### Step 2 — Global Summary (all rows)
Every request computes a full statistical summary from all records:
- Top industries (split by comma since one startup can have multiple)
- Lead owners, lead statuses, countries of residence
- Startup stages, cohorts, tracks, programs
- Count of converted leads, revenue-generating startups, female founder startups

### Step 3 — Keyword Search (relevant rows)
The user's question is tokenized (stop words removed, punctuation stripped, min 3 chars). Keywords are matched case-insensitively against a pre-computed `_searchText` index per row. Up to 30 matching rows are selected and sent to GPT using only the 33 curated KEY_COLUMNS.

### Step 4 — GPT-4o Response
GPT-4o receives the global summary + relevant rows and responds like a database analyst — structured, precise, with citations of which fields were used.

---

## Key Columns Sent to GPT

Only these 33 fields are included in relevant row context (not all 200+):

`First Name`, `Last Name`, `Lead Name`, `Organization/Company/Startup`, `Email`, `Lead Source`, `Lead Status`, `Industry - a`, `AUB Affiliation -a`, `Provide a brief overview of your solution -a`, `Country Of Residence`, `Startup Stage`, `Cohort`, `Generating revenue - a`, `Team Size`, `Female Founders`, `Investment Ask`, `Investment Ready`, `Startup AUB Affiliation`, `Mentors Referred`, `Target Market - a`, `Business Model Type -a`, `Active / Inactive`, `Faculty`, `Is Converted`, `Lead Owner`, `Number of co-founders -a`, `Job Title`, `Startup Registration Location -a`, `Track`, `Program`, `Latest involvement`, `Startup Name - a`

---

## What the Bot Can and Cannot Answer

### ✅ Works Well
| Question Type | Example |
|---|---|
| Total record count | "How many total records does iPark have?" |
| Industry breakdown | "What are the top industries in iPark's ecosystem?" |
| Country lookup | "Give me startups from Lebanon" |
| Specific startup | "Tell me about Carely" |
| Revenue/conversion stats | "How many startups are generating revenue?" |
| Cohort/stage breakdown | "Which cohorts are represented?" |
| Multi-field query | "List revenue-generating startups with their stage and country" |
| Female founders | "How many startups have female founders?" |

### ⚠️ Partial / Inconsistent
| Question Type | Reason |
|---|---|
| "List ALL startups" | Max 30 rows sent to GPT per query |
| Very broad multi-filter | Keyword search may not catch all combinations |
| Sparse fields | If Zoho didn't sync a field, GPT won't know it |

### ❌ Cannot Answer
| Question Type | Reason |
|---|---|
| Averages & calculations | e.g. "Average team size" — not pre-computed |
| Full data export | Context window can't fit 2,168 full rows |
| Complex SQL-style analytics | Not a database query engine |

---

## Why Can't It Read All 2,168 Rows in Detail?

This is a fundamental **token limit** constraint of large language models.

**The math:**
- 2,168 rows × ~500 characters per row = ~1,000,000 characters of raw data
- GPT-4o context window = ~128,000 tokens ≈ ~96,000 words
- Full dataset is approximately **10× larger** than GPT's context window

The bot uses a two-layer approach: a pre-computed statistical summary for aggregate questions, and keyword-matched row retrieval for specific lookups.

---

## Deployment

### Deploy to Vercel
1. Push changes to GitHub (`main` branch)
2. Vercel auto-deploys on every push (~30 seconds)
3. Check logs at: vercel.com/dashboard

### vercel.json
```json
{
  "rewrites": [
    { "source": "/api/chat", "destination": "/api/chat.js" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "ALLOWALL" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors *" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
  ]
}
```

`X-Frame-Options: ALLOWALL` and `frame-ancestors *` are required for Looker Studio iFrame embedding.

### package.json
```json
{
  "name": "ipark-external-chatbot",
  "version": "1.0.0"
}
```
⚠️ Do NOT add `"type": "module"` — backend uses CommonJS (`module.exports`).

---

## Critical Technical Notes

- **Format is TSV not CSV** — the sheet exports tab-separated. Using CSV format or the sheet name instead of gid will break parsing entirely.
- **Row 2 is headers, not Row 1** — Row 1 is a title row. Skipping it correctly is essential.
- **Industry - a stores multiple values** — e.g. "HealthTech, B2B SaaS". The code splits by comma and counts each separately.
- **Keyword search is case-insensitive** — pre-computed `_searchText` in lowercase ensures "Lebanon" matches "lebanon".

---


