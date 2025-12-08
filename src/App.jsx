// src/App.jsx

import { useState } from 'react';
import './App.css';
import { API_BASE_URL } from './config';

// Helper: R/plumber often returns length-1 vectors as arrays: ["ok"]
// This converts ["ok"] -> "ok", and leaves normal strings unchanged.
function normalizeScalar(value) {
  if (Array.isArray(value) && value.length === 1) {
    return value[0];
  }
  return value;
}

function ChatPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Robust typewriter: shows the substring [0, index) each tick
  function typeWriterEffect(fullText, setStateCallback, speed = 20) {
    const text = String(fullText ?? ''); // ensure it's a plain string
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
        headers: {
          'Content-Type': 'application/json',
        },
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
          // ignore JSON parse errors
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

      // Make sure we always pass a well-formed string to the typewriter
      const rawAnswer = normalizeScalar(data.answer);
      const finalAnswer =
        (typeof rawAnswer === 'string' && rawAnswer.length > 0)
          ? rawAnswer
          : '(No answer field returned)';

      // Typewriter animation
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
            <p className="answer-text">
              {answer}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RagasPanel() {
  const [summary, setSummary] = useState(null); // array of { metric, mean, min, max }
  const [nQa, setNQa] = useState(0);
  const [plotPath, setPlotPath] = useState('');
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async () => {
    setError('');
    setLoadingAnalyze(true);

    try {
      // 1) Trigger report generation (creates CSV + PNG & metrics RDS)
      const reportResp = await fetch(`${API_BASE_URL}/ragas/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // no body needed, but JSON keeps it consistent
      });

      if (!reportResp.ok) {
        let msg = `Request to /ragas/report failed with status ${reportResp.status}`;
        try {
          const body = await reportResp.json();
          if (body && body.message) {
            msg = body.message;
          }
        } catch {
          // ignore parsing error
        }
        throw new Error(msg);
      }

      const reportData = await reportResp.json();
      console.log('Raw /ragas/report response:', reportData);

      const statusReport = normalizeScalar(reportData.status ?? 'ok');
      if (statusReport !== 'ok') {
        const msg =
          normalizeScalar(reportData.message) || 'RAGAS report failed.';
        throw new Error(msg);
      }

      const plot = normalizeScalar(reportData.plot_path ?? '');
      setPlotPath(plot);

      // 2) Fetch metrics + summary as JSON from GET /ragas
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
          // ignore parsing error
        }
        throw new Error(msg);
      }

      const metricsData = await metricsResp.json();
      console.log('Raw /ragas response:', metricsData);

      const statusMetrics = normalizeScalar(metricsData.status ?? 'ok');
      if (statusMetrics !== 'ok') {
        const msg =
          normalizeScalar(metricsData.message) || 'RAGAS metrics retrieval failed.';
        throw new Error(msg);
      }

      const n = normalizeScalar(metricsData.n_qa ?? 0);
      setNQa(typeof n === 'number' ? n : Number(n) || 0);

      const summaryArray = metricsData.summary || [];
      setSummary(summaryArray);
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          'An unexpected error occurred while computing RAGAS metrics.'
      );
      setSummary(null);
      setNQa(0);
      setPlotPath('');
    } finally {
      setLoadingAnalyze(false);
    }
  };

  const handleClear = async () => {
    setError('');
    setLoadingClear(true);

    try {
      const resp = await fetch(`${API_BASE_URL}/ragas/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // consistent JSON body
      });

      if (!resp.ok) {
        let msg = `Request to /ragas/clear failed with status ${resp.status}`;
        try {
          const body = await resp.json();
          if (body && body.message) {
            msg = body.message;
          }
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const data = await resp.json();
      console.log('Raw /ragas/clear response:', data);

      const status = normalizeScalar(data.status ?? 'ok');
      if (status !== 'ok') {
        const msg =
          normalizeScalar(data.message) || 'Failed to clear RAGAS data.';
        throw new Error(msg);
      }

      // Reset UI state
      setSummary(null);
      setNQa(0);
      setPlotPath('');
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
                      <td>{row.mean}</td>
                      <td>{row.min}</td>
                      <td>{row.max}</td>
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
          {!plotPath && !loadingAnalyze && !error && (
            <p className="placeholder-text">
              When you click "Analyze", the backend will generate a PNG chart of
              RAGAS metrics and save it to disk. The chart will appear here.
            </p>
          )}

          {plotPath && !loadingAnalyze && (
            <>
              <p className="placeholder-text">
                Chart generated on backend at: <code>{plotPath}</code>
              </p>
              <div className="chart-image-wrapper">
                <img
                  src={`${API_BASE_URL}/ragas-plots/${plotPath.split('/').pop()}`}
                  alt="RAGAS metrics chart"
                  className="chart-image"
                />
              </div>
            </>
          )}

          {loadingAnalyze && (
            <p className="placeholder-text">
              Generating RAGAS chart on the backend…
            </p>
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
          Retrieval-Augmented Generation + RAGAS evaluation (frontend)
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
