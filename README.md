# ragR Frontend

This is a minimal React + Vite frontend for the `ragR` backend.

It provides a simple user interface for:

- Asking questions through the RAG chatbot API
- Displaying generated answers
- Running RAGAS evaluation from the logged Q/A pairs
- Displaying a metrics summary table
- Displaying a frontend-generated bar chart of mean RAGAS scores
- Clearing the Q/A log, metrics, and report outputs through the backend

The frontend is designed to work with the `ragR` R package backend running locally through Plumber.

---

## Backend requirement

Before starting the frontend, the `ragR` backend must be running.

From the `ragR` backend project root:

```bash
Rscript scripts/dev/run_api.R
```

By default, the backend runs at:

```text
http://127.0.0.1:8000
```

The backend exposes the main API endpoints used by this frontend:

| Endpoint | Method | Purpose |
|---|---:|---|
| `/chat` | POST | Send a user question to the RAG pipeline |
| `/ragas/report` | POST | Compute and save RAGAS metrics/report artifacts |
| `/ragas` | GET | Return RAGAS metrics and summary as JSON |
| `/ragas/clear` | POST | Clear QA log, metrics, and report files |

The frontend does not perform document ingestion. Documents should be ingested through backend development scripts, such as:

```bash
Rscript scripts/dev/demo_ingest.R
```

---

## Project structure

```text
RAGR-FE/
├── public/
├── src/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   ├── config.js
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── eslint.config.js
└── README.md
```

Important files:

| File | Purpose |
|---|---|
| `src/App.jsx` | Main frontend logic for Chat and RAGAS panels |
| `src/App.css` | Main styling for the interface |
| `src/config.js` | Backend API base URL |
| `src/main.jsx` | React entry point |

---

## Configuration

The backend URL is configured in:

```text
src/config.js
```

Default:

```js
export const API_BASE_URL = 'http://127.0.0.1:8000';
```

If the backend runs on a different host or port, update this value.

---

## Installation

From the frontend project root:

```bash
npm install
```

This installs the dependencies listed in `package.json`.

---

## Running the frontend

Start the Vite development server:

```bash
npm run dev
```

Vite will show a local URL, usually:

```text
http://localhost:5173/
```

Open that URL in your browser.

---

## Typical workflow

### 1. Start the backend

In the backend `ragR` project:

```bash
Rscript scripts/dev/run_api.R
```

### 2. Start the frontend

In the frontend `RAGR-FE` project:

```bash
npm run dev
```

### 3. Ask questions

Use the **Chat** panel to ask questions.

Each question is sent to:

```text
POST /chat
```

The backend:

1. Runs the RAG pipeline.
2. Generates an answer.
3. Logs the Q/A interaction into `db/qa_log.rds`.

### 4. Run RAGAS evaluation

Click **Analyze** in the RAGAS Evaluation panel.

The frontend calls:

```text
POST /ragas/report
GET  /ragas
```

The backend computes LLM-scored RAGAS-style metrics and returns a summary.

The frontend displays:

- Number of Q/A pairs
- Metrics summary table
- Bar chart of mean metric scores

The bar chart is generated directly in the frontend from the returned summary values, so it updates every time **Analyze** is pressed.

### 5. Clear RAGAS data

Click **Clear** in the RAGAS Evaluation panel.

The frontend calls:

```text
POST /ragas/clear
```

The backend clears:

- `db/qa_log.rds`
- `db/qa_metrics.rds`
- `reports/ragas/`

The vector store is not cleared. Previously ingested documents remain available for future questions.

---

## RAGAS metrics shown

The frontend displays the following metrics when returned by the backend:

- `context_precision`
- `context_recall`
- `answer_relevance`
- `faithfulness`
- `ragas_overall`

The table shows:

- Mean
- Minimum
- Maximum

The chart displays the **mean score** for each metric on a 0 to 1 scale.

---

## Development notes

This frontend is intentionally minimal. It is mainly designed for local demos and testing the `ragR` backend.

Current behavior:

- Chat answers are displayed with a typewriter effect.
- RAGAS metrics are fetched from the backend as JSON.
- The RAGAS chart is rendered directly in React/SVG from the summary table.
- No external charting library is required.
- The frontend assumes the backend is already running and has access to an ingested vector store.

---

## Troubleshooting

### The Chat panel returns a 500 error

Check the backend terminal. Common causes include:

- The backend is not running.
- `OPENAI_API_KEY` is not set.
- The requested vector-store collection does not exist.
- The backend package was changed but not reinstalled/restarted.

Restart the backend after backend code changes:

```bash
Rscript scripts/dev/run_api.R
```

### The frontend cannot connect to the backend

Check `src/config.js` and confirm that the backend URL is correct:

```js
export const API_BASE_URL = 'http://127.0.0.1:8000';
```

Also confirm the backend is running:

```text
http://127.0.0.1:8000/__docs__/
```

### RAGAS Analyze takes a long time

This is expected for LLM-scored RAGAS metrics, especially when the QA log contains many rows. Try testing with a smaller QA log first.

### The Clear button removed old metrics

This is expected. The Clear button calls `/ragas/clear`, which clears backend Q/A logs, saved metrics, and report outputs. It does not clear the vector store.

---

## Build

To build the frontend for production:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## Related project

This frontend is intended to be used with the `ragR` backend package:

```text
ragR: Retrieval-Augmented Generation and RAGAS Evaluation in R
```

---

## Author

Muhammad Aimal Rehman
