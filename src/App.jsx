// src/App.jsx

import { useState } from 'react';
import './App.css';
import { API_BASE_URL } from './config';

// Helper: plumber/R sometimes returns length-1 vectors as arrays.
// Example: ["ok"] -> "ok"
function normalizeScalar(value) {
  if (Array.isArray(value) && value.length === 1) {
    return value[0];
  }
  return value;
}

function formatMetricValue(value) {
  const x = Number(value);
  if (!Number.isFinite(x)) return 'NA';
  return x.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function prettyMetricLabel(metric) {
  switch (metric) {
    case 'context_precision':
      return 'Context Precision';
    case 'context_recall':
      return 'Context Recall';
    case 'answer_relevance':
      return 'Answer Relevance';
    case 'faithfulness':
      return 'Faithfulness';
    case 'ragas_overall':
      return 'RAGAS Overall';
    default:
      return metric;
  }
}

function ChatPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function typeWriterEffect(fullText, setStateCallback, speed = 20) {
    const text = String(fullText ?? '');
    let index = 0;
    setStateCallback('');

    function tick() {
      if (index <= text.length) {
        setStateCallback(text.slice(0, index));
        index += 1;

        if (index <= text.length) {
          setTimeout(tick, speed);
        }
      }
    }

    tick();
  }

  const handleAsk = async () => {
    if (!question.trim()) {
      setError('Please enter a question before asking.');
      return;
    }

    setError('');
    setLoading(true);
    setAnswer('');

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        let msg = `Request failed with status ${response.status}`;

        try {
          const errBody = await response.json();
          if (errBody && errBody.message) {
            msg = errBody.message;
          }
        } catch {
          // Ignore JSON parse errors.
        }

        throw new Error(msg);
      }

      const data = await response.json();
      console.log('Raw /chat response:', data);

      const status = normalizeScalar(data.status ?? 'ok');
      if (status !== 'ok') {
        const msg = normalizeScalar(data.message) || 'Backend returned an error.';
        throw new Error(msg);
      }

      const rawAnswer = normalizeScalar(data.answer);
      const finalAnswer =
        typeof rawAnswer === 'string' && rawAnswer.length > 0
          ? rawAnswer
          : '(No answer field returned)';

      typeWriterEffect(finalAnswer, setAnswer, 20);
    } catch (err) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2>Chat</h2>

      <div className="field">
        <label htmlFor="question">Question</label>
        <textarea
          id="question"
          className="text-input"
          placeholder="Type your question here..."
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </div>

      <button
        className="primary-button"
        onClick={handleAsk}
        disabled={loading}
      >
        {loading ? 'Asking…' : 'Ask'}
      </button>

      {error && <p className="error-text">{error}</p>}

      <div className="field">
        <label>Answer</label>
        <div className="answer-box">
          {loading && !answer && (
            <p className="placeholder-text">
              Waiting for response from RAG backend…
            </p>
          )}

          {!loading && !answer && !error && (
            <p className="placeholder-text">
              The answer from the RAG pipeline will appear here.
            </p>
          )}

          {!loading && answer && (
            <p className="answer-text">{answer}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function RagasBarChart({ summary }) {
  if (!Array.isArray(summary) || summary.length === 0) {
    return null;
  }

  const data = summary.map((row) => ({
    metric: row.metric,
    label: prettyMetricLabel(row.metric),
    mean: Math.max(0, Math.min(1, Number(row.mean) || 0)),
  }));

  const width = 920;
  const height = 520;

  const margin = {
    top: 70,
    right: 30,
    bottom: 140,
    left: 85,
  };

  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  const step = plotWidth / data.length;
  const barWidth = Math.min(90, step * 0.55);

  const getX = (index) => margin.left + index * step + (step - barWidth) / 2;
  const getY = (value) => margin.top + (1 - value) * plotHeight;

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '18px',
        border: '1px solid #d9dde5',
        borderRadius: '18px',
        background: '#ffffff',
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ display: 'block' }}
        role="img"
        aria-label="RAGAS mean metric scores bar chart"
      >
        {/* Title */}
        <text
          x={width / 2}
          y={34}
          textAnchor="middle"
          fontSize="24"
          fontWeight="700"
          fill="#1f2937"
        >
          RAGAS Mean Metric Scores
        </text>

        {/* Y-axis label */}
        <text
          x={24}
          y={margin.top + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 24 ${margin.top + plotHeight / 2})`}
          fontSize="18"
          fontWeight="600"
          fill="#374151"
        >
          Mean Score
        </text>

        {/* X-axis label */}
        <text
          x={margin.left + plotWidth / 2}
          y={height - 22}
          textAnchor="middle"
          fontSize="18"
          fontWeight="600"
          fill="#374151"
        >
          Metrics
        </text>

        {/* Grid lines + y ticks */}
        {yTicks.map((tick) => {
          const y = getY(tick);
          return (
            <g key={tick}>
              <line
                x1={margin.left}
                y1={y}
                x2={margin.left + plotWidth}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={margin.left - 12}
                y={y + 5}
                textAnchor="end"
                fontSize="15"
                fill="#4b5563"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotHeight}
          stroke="#6b7280"
          strokeWidth="2"
        />
        <line
          x1={margin.left}
          y1={margin.top + plotHeight}
          x2={margin.left + plotWidth}
          y2={margin.top + plotHeight}
          stroke="#6b7280"
          strokeWidth="2"
        />

        {/* Bars */}
        {data.map((d, i) => {
          const x = getX(i);
          const y = getY(d.mean);
          const h = margin.top + plotHeight - y;
          const centerX = x + barWidth / 2;

          return (
            <g key={d.metric}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx="6"
                fill="#4f7cff"
              />

              {/* Value label */}
              <text
                x={centerX}
                y={y - 10}
                textAnchor="middle"
                fontSize="15"
                fontWeight="600"
                fill="#1f2937"
              >
                {formatMetricValue(d.mean)}
              </text>

              {/* X tick label */}
              <text
                x={centerX}
                y={margin.top + plotHeight + 24}
                textAnchor="end"
                transform={`rotate(-28 ${centerX} ${margin.top + plotHeight + 24})`}
                fontSize="15"
                fill="#374151"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RagasPanel() {
  const [summary, setSummary] = useState(null);
  const [nQa, setNQa] = useState(0);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleAnalyze = async () => {
    setError('');
    setInfoMessage('');
    setLoadingAnalyze(true);

    try {
      const reportResp = await fetch(`${API_BASE_URL}/ragas/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!reportResp.ok) {
        let msg = `Request to /ragas/report failed with status ${reportResp.status}`;

        try {
          const body = await reportResp.json();
          if (body && body.message) {
            msg = body.message;
          }
        } catch {
          // Ignore JSON parse errors.
        }

        throw new Error(msg);
      }

      const reportData = await reportResp.json();
      console.log('Raw /ragas/report response:', reportData);

      const statusReport = normalizeScalar(reportData.status ?? 'ok');
      if (statusReport !== 'ok') {
        const msg = normalizeScalar(reportData.message) || 'RAGAS report failed.';
        throw new Error(msg);
      }

      const metricsResp = await fetch(`${API_BASE_URL}/ragas`, {
        method: 'GET',
      });

      if (!metricsResp.ok) {
        let msg = `Request to /ragas failed with status ${metricsResp.status}`;

        try {
          const body = await metricsResp.json();
          if (body && body.message) {
            msg = body.message;
          }
        } catch {
          // Ignore JSON parse errors.
        }

        throw new Error(msg);
      }

      const metricsData = await metricsResp.json();
      console.log('Raw /ragas response:', metricsData);

      const statusMetrics = normalizeScalar(metricsData.status ?? 'ok');
      if (statusMetrics !== 'ok') {
        const msg =
          normalizeScalar(metricsData.message) ||
          'RAGAS metrics retrieval failed.';
        throw new Error(msg);
      }

      const n = normalizeScalar(metricsData.n_qa ?? 0);
      setNQa(typeof n === 'number' ? n : Number(n) || 0);

      const summaryArray = Array.isArray(metricsData.summary)
        ? metricsData.summary
        : [];
      setSummary(summaryArray);

      const backendMsg = normalizeScalar(metricsData.message ?? '');
      if (backendMsg) {
        setInfoMessage(backendMsg);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          'An unexpected error occurred while computing RAGAS metrics.'
      );
      setSummary(null);
      setNQa(0);
      setInfoMessage('');
    } finally {
      setLoadingAnalyze(false);
    }
  };

  const handleClear = async () => {
    setError('');
    setInfoMessage('');
    setLoadingClear(true);

    try {
      const resp = await fetch(`${API_BASE_URL}/ragas/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!resp.ok) {
        let msg = `Request to /ragas/clear failed with status ${resp.status}`;

        try {
          const body = await resp.json();
          if (body && body.message) {
            msg = body.message;
          }
        } catch {
          // Ignore JSON parse errors.
        }

        throw new Error(msg);
      }

      const data = await resp.json();
      console.log('Raw /ragas/clear response:', data);

      const status = normalizeScalar(data.status ?? 'ok');
      if (status !== 'ok') {
        const msg = normalizeScalar(data.message) || 'Failed to clear RAGAS data.';
        throw new Error(msg);
      }

      setSummary(null);
      setNQa(0);
      setInfoMessage('RAGAS outputs cleared successfully.');
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          'An unexpected error occurred while clearing RAGAS data.'
      );
    } finally {
      setLoadingClear(false);
    }
  };

  const hasSummary = Array.isArray(summary) && summary.length > 0;

  return (
    <div className="panel">
      <h2>RAGAS Evaluation</h2>

      <div className="ragas-buttons">
        <button
          className="primary-button"
          onClick={handleAnalyze}
          disabled={loadingAnalyze || loadingClear}
        >
          {loadingAnalyze ? 'Analyzing…' : 'Analyze'}
        </button>

        <button
          className="secondary-button"
          onClick={handleClear}
          disabled={loadingAnalyze || loadingClear}
        >
          {loadingClear ? 'Clearing…' : 'Clear'}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {infoMessage && !error && (
        <p className="placeholder-text">{infoMessage}</p>
      )}

      <div className="field">
        <label>Metrics Summary</label>
        <div className="metrics-box">
          {loadingAnalyze && (
            <p className="placeholder-text">
              Computing RAGAS metrics based on the QA log…
            </p>
          )}

          {!loadingAnalyze && !hasSummary && nQa === 0 && !error && (
            <p className="placeholder-text">
              No RAGAS metrics yet. Collect some Q/A interactions, then click
              "Analyze".
            </p>
          )}

          {!loadingAnalyze && hasSummary && (
            <div>
              <p className="metrics-caption">
                Number of Q/A pairs: <strong>{nQa}</strong>
              </p>

              <table className="metrics-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Mean</th>
                    <th>Min</th>
                    <th>Max</th>
                  </tr>
                </thead>

                <tbody>
                  {summary.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.metric}</td>
                      <td>{formatMetricValue(row.mean)}</td>
                      <td>{formatMetricValue(row.min)}</td>
                      <td>{formatMetricValue(row.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="field">
        <label>Metrics Chart</label>
        <div className="metrics-chart-box">
          {!loadingAnalyze && !hasSummary && !error && (
            <p className="placeholder-text">
              A bar chart of the mean metric scores will appear here after you
              click "Analyze".
            </p>
          )}

          {loadingAnalyze && (
            <p className="placeholder-text">
              Preparing bar chart from the latest RAGAS results…
            </p>
          )}

          {!loadingAnalyze && hasSummary && (
            <RagasBarChart summary={summary} />
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <h1>ragR Frontend</h1>
        <p className="subtitle">
          Retrieval-Augmented Generation + RAGAS evaluation
        </p>
      </header>

      <main className="app-main">
        <ChatPanel />
        <RagasPanel />
      </main>
    </div>
  );
}

export default App;