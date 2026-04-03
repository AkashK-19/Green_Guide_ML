import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import '../styles/AITools.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSessionId() {
  let id = sessionStorage.getItem('greenbot_session');
  if (!id) { id = uuidv4(); sessionStorage.setItem('greenbot_session', id); }
  return id;
}

function fmt(name) {
  if (!name) return 'Unknown';
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Disease metadata ─────────────────────────────────────────────────────────

const DISEASE_META = {
  healthy:             { icon: '✦', color: '#16a34a', light: '#dcfce7', dark: '#14532d', label: 'No Disease Detected' },
  early_blight:        { icon: '◈', color: '#d97706', light: '#fef3c7', dark: '#78350f', label: 'Moderate — Early Stage' },
  late_blight:         { icon: '⬟', color: '#dc2626', light: '#fee2e2', dark: '#7f1d1d', label: 'Severe — Immediate Action' },
  powdery_mildew:      { icon: '◈', color: '#d97706', light: '#fef3c7', dark: '#78350f', label: 'Moderate Infection' },
  downy_mildew:        { icon: '◈', color: '#d97706', light: '#fef3c7', dark: '#78350f', label: 'Moderate Infection' },
  leaf_spot_fungal:    { icon: '◉', color: '#0284c7', light: '#e0f2fe', dark: '#0c4a6e', label: 'Low Risk' },
  bacterial_spot:      { icon: '◈', color: '#d97706', light: '#fef3c7', dark: '#78350f', label: 'Moderate Concern' },
  rust_disease:        { icon: '◈', color: '#d97706', light: '#fef3c7', dark: '#78350f', label: 'Moderate Warning' },
  mosaic_virus:        { icon: '⬟', color: '#dc2626', light: '#fee2e2', dark: '#7f1d1d', label: 'Severe Viral Infection' },
  leaf_curl_virus:     { icon: '◈', color: '#d97706', light: '#fef3c7', dark: '#78350f', label: 'Moderate Virus' },
  nutrient_deficiency: { icon: '◉', color: '#0284c7', light: '#e0f2fe', dark: '#0c4a6e', label: 'Nutrient Issue' },
  root_rot_wilting:    { icon: '⬟', color: '#dc2626', light: '#fee2e2', dark: '#7f1d1d', label: 'Severe — Root Damage' },
  sooty_mold:          { icon: '◉', color: '#0284c7', light: '#e0f2fe', dark: '#0c4a6e', label: 'Low Risk' },
  anthracnose:         { icon: '◈', color: '#d97706', light: '#fef3c7', dark: '#78350f', label: 'Moderate Infection' },
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function chatWithBot(message, sessionId) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId }),
  });
  if (res.status === 404) throw new Error('Route not found. Is the backend running?');
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.message || `Server error (${res.status})`);
  }
  const data = await res.json();
  return data.reply || 'No response.';
}

async function fetchInsight(disease) {
  const res = await fetch('/api/disease-insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ disease }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.insight || null;
}

function parseInsight(raw) {
  if (!raw) return null;
  const sections = { what: '', why: '', how: '' };
  const whatMatch = raw.match(/\*\*What it is:\*\*\s*([^\n*]+)/i);
  const whyMatch  = raw.match(/\*\*Why it happens:\*\*\s*([^\n*]+)/i);
  const howMatch  = raw.match(/\*\*How to control it:\*\*\s*([^\n*]+)/i);
  if (whatMatch) sections.what = whatMatch[1].trim();
  if (whyMatch)  sections.why  = whyMatch[1].trim();
  if (howMatch)  sections.how  = howMatch[1].trim();
  if (!sections.what && !sections.why && !sections.how) return { raw };
  return sections;
}

function parseBotResponse(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const hasBullets = lines.some(l => l.trim().startsWith('•') || l.trim().startsWith('-'));
  const hasTip = text.includes('💡');
  if (hasBullets || hasTip) return { structured: true, raw: text };
  return { structured: false, raw: text };
}

// ─── Bot Avatar — uses real image from online ─────────────────────────────────
// A friendly AI plant assistant image from Unsplash / public CDN
const BOT_IMG = 'https://img.icons8.com/?size=100&id=zFvpUekVfBK6&format=png&color=000000';

function BotAvatar({ size = 28, isHeader = false }) {
  const [err, setErr] = React.useState(false);
  if (isHeader) {
    return (
      <div className="gb-avatar" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
        {err ? (
          <div className="gb-avatar-fallback">🌿</div>
        ) : (
          <img
            src={BOT_IMG}
            alt="GreenBot"
            onError={() => setErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>
    );
  }
  return (
    <div className="gb-msg-avatar" style={{ width: size, height: size, borderRadius: size * 0.28 }}>
      {err ? (
        <div className="gb-msg-avatar-fallback">🌿</div>
      ) : (
        <img
          src={BOT_IMG}
          alt="GreenBot"
          onError={() => setErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
    </div>
  );
}

// ─── Structured Bot Message ───────────────────────────────────────────────────

function BotMessage({ text }) {
  const parsed = parseBotResponse(text);
  if (!parsed.structured) {
    return <div className="gb-bub-b">{text}</div>;
  }
  const lines = text.split('\n');
  return (
    <div className="gb-bub-structured">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return <div key={i} className="gb-msg-topic">{trimmed.replace(/\*\*/g, '')}</div>;
        }
        if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
          return <div key={i} className="gb-msg-bullet"><span className="gb-bullet-dot">·</span>{trimmed.replace(/^[•-]\s*/, '')}</div>;
        }
        if (trimmed.startsWith('💡')) {
          return <div key={i} className="gb-msg-tip">{trimmed}</div>;
        }
        return <div key={i} className="gb-msg-plain">{trimmed}</div>;
      })}
    </div>
  );
}

// ─── Floating Chatbot — Full Redesign ─────────────────────────────────────────

const QUICK = ['Tulsi watering tips?', 'Yellow leaf causes?', 'How to use Neem oil?'];

function FloatingChatbot() {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [fabImgErr, setFabImgErr] = useState(false);
  const bottomRef = useRef(null);
  const sessionId = useRef(getSessionId());
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [messages, open, loading]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setTimeout(() => setMessages([{
        role: 'bot',
        text: "Hey there! 👋\nI'm GreenBot, your plant care assistant.\nWhat can I help you with today?",
      }]), 300);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 420);
  }, [open]);

  async function send(textOverride) {
    const text = (typeof textOverride === 'string' ? textOverride : input).trim();
    if (!text || loading) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const reply = await chatWithBot(text, sessionId.current);
      setMessages(prev => [...prev, { role: 'bot', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }

  const showChips = messages.length === 1 && messages[0].role === 'bot';

  function handleInput(e) {
    setInput(e.target.value);
    const t = e.target;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 90)}px`;
  }

  return (
    <div className="gb gb-wrap">
      {open && (
        <div className="gb-panel">

          {/* ── Header ── */}
          <div className="gb-head">
            <div className="gb-head-left">
              <BotAvatar size={46} isHeader />
              <div className="gb-head-details">
                <div className="gb-name">GreenBot</div>
                <div className="gb-tagline">Your plant care AI assistant</div>
                <div className="gb-status">
                  <span className="gb-status-dot" />
                  <span className="gb-status-text">Active now</span>
                </div>
              </div>
            </div>

            {/* ── Close button — WHITE X, always visible ── */}
            <button
              className="gb-x"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              type="button"
            >
              <svg
                width="14" height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* ── Messages ── */}
          <div className="gb-msgs">
            <div className="gb-day">Today</div>

            {messages.map((m, i) => (
              <React.Fragment key={i}>
                {m.role === 'bot' ? (
                  <div className="gb-row-b">
                    <BotAvatar size={28} />
                    <BotMessage text={m.text} />
                  </div>
                ) : (
                  <div className="gb-row-u">
                    <div className="gb-bub-u">{m.text}</div>
                  </div>
                )}
              </React.Fragment>
            ))}

            {loading && (
              <div className="gb-typing-row">
                <BotAvatar size={28} />
                <div className="gb-typing-bub">
                  <div className="gb-d" /><div className="gb-d" /><div className="gb-d" />
                </div>
              </div>
            )}

            {showChips && (
              <div className="gb-chips">
                {QUICK.map((q, i) => (
                  <button key={i} className="gb-chip" onClick={() => send(q)} type="button">{q}</button>
                ))}
              </div>
            )}

            <div ref={bottomRef} style={{ height: 1 }} />
          </div>

          {/* ── Input footer ── */}
          <div className="gb-foot">
            <div className="gb-inp-wrap">
              <textarea
                ref={inputRef}
                className="gb-inp"
                value={input}
                onChange={handleInput}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Ask about plant care, diseases…"
                disabled={loading}
                autoComplete="off"
                rows={1}
              />

              {/* ── Send button — solid green rounded square with paper-plane icon ── */}
              <button
                className="gb-send"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                aria-label="Send message"
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 2L11 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── FAB — White pill with real bot image, visible on any background ── */}
      <button
        className={`gb-fab${open ? ' is-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close chat' : 'Open GreenBot chat'}
        type="button"
      >
        {open ? (
          /* Open state: dark circle with bright white X */
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 2L16 16M16 2L2 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          /* Closed: image + text pill */
          <>
            <div className="gb-fab-img-wrap">
              {fabImgErr ? (
                <div className="gb-fab-img-fallback">🌿</div>
              ) : (
                <img
                  src={BOT_IMG}
                  alt="GreenBot"
                  onError={() => setFabImgErr(true)}
                />
              )}
            </div>
            <div className="gb-fab-text">
              <span className="gb-fab-title">GreenBot</span>
              <span className="gb-fab-sub">Plant care assistant</span>
            </div>
            <div className="gb-fab-ping" />
          </>
        )}
      </button>
    </div>
  );
}

// ─── AI Insight Panel ─────────────────────────────────────────────────────────

function InsightPanel({ disease, meta }) {
  const [insight,    setInsight]    = useState(null);
  const [insLoading, setInsLoading] = useState(true);

  useEffect(() => {
    setInsight(null);
    setInsLoading(true);
    fetchInsight(disease)
      .then(raw => setInsight(parseInsight(raw)))
      .finally(() => setInsLoading(false));
  }, [disease]);

  if (insLoading) {
    return (
      <div className="ait-insight-panel">
        <div className="ait-insight-header">
          <span className="ait-insight-icon">🤖</span>
          <span className="ait-insight-title">AI Insight</span>
        </div>
        <div className="ait-ai-dots">
          <div className="ait-ai-dot" /><div className="ait-ai-dot" /><div className="ait-ai-dot" />
          <span className="ait-ai-loading-text">Generating insight…</span>
        </div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="ait-insight-panel">
        <div className="ait-insight-header">
          <span className="ait-insight-icon">🤖</span>
          <span className="ait-insight-title">AI Insight</span>
        </div>
        <p className="ait-ai-unavailable">Insight unavailable for this condition.</p>
      </div>
    );
  }

  if (insight.raw && !insight.what) {
    return (
      <div className="ait-insight-panel">
        <div className="ait-insight-header">
          <span className="ait-insight-icon">🤖</span>
          <span className="ait-insight-title">AI Insight</span>
        </div>
        <p className="ait-ai-text">{insight.raw}</p>
      </div>
    );
  }

  return (
    <div className="ait-insight-panel">
      <div className="ait-insight-header">
        <span className="ait-insight-title">AI Insight</span>
      </div>
      <div className="ait-insight-sections">
        {insight.what && (
          <div className="ait-insight-row">
            <div className="ait-insight-row-label">
              <span className="ait-insight-row-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>📋</span>
              What it is
            </div>
            <p className="ait-insight-row-text">{insight.what}</p>
          </div>
        )}
        {insight.why && (
          <div className="ait-insight-row">
            <div className="ait-insight-row-label">
              <span className="ait-insight-row-icon" style={{ background: '#fef3c7', color: '#92400e' }}>🔍</span>
              Why it happens
            </div>
            <p className="ait-insight-row-text">{insight.why}</p>
          </div>
        )}
        {insight.how && (
          <div className="ait-insight-row ait-insight-row-last">
            <div className="ait-insight-row-label">
              <span className="ait-insight-row-icon" style={{ background: '#dcfce7', color: '#15803d' }}>💊</span>
              How to control it
            </div>
            <p className="ait-insight-row-text">{insight.how}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Plant Identifier Tool ────────────────────────────────────────────────────

const CONFIDENCE_COLOR = (c) => {
  if (c >= 60) return { color: '#16a34a', light: '#dcfce7', label: 'High Confidence' };
  if (c >= 40) return { color: '#d97706', light: '#fef3c7', label: 'Moderate Confidence' };
  return { color: '#dc2626', light: '#fee2e2', label: 'Low Confidence — Retake Photo' };
};

function PlantIdentifier() {
  const [image,      setImage]      = useState(null);
  const [file,       setFile]       = useState(null);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [dragOver,   setDragOver]   = useState(false);
  const [animateBar, setAnimateBar] = useState(false);
  const inputRef = useRef();

  function handleFile(f) {
    if (!f?.type.startsWith('image/')) { setError('Please upload a valid image (JPG, PNG, WEBP).'); return; }
    if (f.size > 10 * 1024 * 1024)    { setError('File too large. Maximum 10 MB.'); return; }
    setFile(f); setImage(URL.createObjectURL(f));
    setResult(null); setError(''); setAnimateBar(false);
  }

  function onDrop(e) { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }

  async function identify() {
    if (!file) return;
    setLoading(true); setError(''); setResult(null); setAnimateBar(false);
    try {
      const form = new FormData();
      form.append('image', file);
      const res  = await fetch('/api/plant-identify', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Identification failed. Is the plant ML server running?');
      setResult(data);
      setTimeout(() => setAnimateBar(true), 100);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function reset() {
    setImage(null); setFile(null); setResult(null);
    setError(''); setAnimateBar(false);
  }

  const conf = result ? CONFIDENCE_COLOR(result.confidence) : null;

  return (
    <div className="ait-grid">
      {/* ── Left: Upload ─────────────────── */}
      <div>
        {!image ? (
          <div
            className={`ait-dropzone${dragOver ? ' drag-over' : ''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="ait-dropzone-icon pi-dropzone-icon">{dragOver ? '📂' : '🌿'}</div>
            <h3>{dragOver ? 'Release to upload' : 'Upload plant photo'}</h3>
            <p>Drag & drop or click to browse<br />JPG, PNG, WEBP — max 10 MB</p>
            <button className="ait-choose-btn pi-choose-btn">Choose File</button>
            <input ref={inputRef} type="file" accept="image/*"
              onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
          </div>
        ) : (
          <div className="ait-preview-card">
            <div className="ait-preview-img-wrap">
              <img src={image} alt="Plant" className={loading ? 'loading' : ''} />
              {loading && (
                <>
                  <div className="ait-scan-line pi-scan-line" />
                  <div className="ait-scan-overlay">
                    <div className="ait-scan-spinner pi-scan-spinner" />
                    <div className="ait-scan-label">Identifying plant…</div>
                  </div>
                </>
              )}
              {result && (
                <div className="ait-complete-badge">
                  <div className="ait-complete-dot" style={{ background: '#34d399' }} />
                  <span>Identified</span>
                </div>
              )}
            </div>
            <div className="ait-preview-actions">
              {!result && !loading && (
                <button className="ait-btn-diagnose pi-btn-identify" onClick={identify}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M11 8v3l2 2" strokeLinecap="round" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Identify Plant
                </button>
              )}
              {(result || loading) && (
                <button className="ait-btn-secondary" onClick={reset}>← New Photo</button>
              )}
              {!result && !loading && (
                <button className="ait-btn-replace" onClick={() => inputRef.current.click()}>Replace</button>
              )}
              <input ref={inputRef} type="file" accept="image/*"
                onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
            </div>
          </div>
        )}

        {error && <div className="ait-error"><strong>Error:</strong> {error}</div>}

        <div className="ait-conditions-box pi-info-box">
          <div className="ait-conditions-label">About this tool</div>
          <p className="pi-info-text">
            Powered by an EfficientNetB0 model trained on Ayurvedic & medicinal plant species.
            Upload a clear photo of the whole plant or a prominent leaf for best results.
          </p>
        </div>
      </div>

      {/* ── Right: Results ───────────────── */}
      <div>
        {!result && !loading && !error && (
          <div className="ait-placeholder">
            <div className="ait-placeholder-icon pi-placeholder-icon">🌱</div>
            <h3>Awaiting Photo</h3>
            <p>Upload a clear plant photo to identify the species</p>
          </div>
        )}

        {loading && (
          <div className="ait-placeholder">
            <div className="ait-processing-spinner pi-processing-spinner" />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>Identifying Plant</div>
            <div style={{ color: '#6b7280', fontSize: 14 }}>Running through plant classifier…</div>
          </div>
        )}

        {result && conf && (
          <div className="ait-result-stack">
            {/* Primary result card */}
            <div className="ait-result-card pi-result-card" style={{
              border: `1.5px solid ${conf.color}30`,
              boxShadow: `0 8px 32px ${conf.color}12`,
            }}>
              <div className="ait-result-bar" style={{ background: `linear-gradient(90deg, ${conf.color}, ${conf.color}88)` }} />
              <div className="ait-result-body">
                <div className="ait-result-top">
                  <div className="ait-result-icon-wrap" style={{ background: conf.light, fontSize: 28 }}>
                    🌿
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="ait-result-label-small">Identified Plant</div>
                    <div className="ait-result-disease-name">{fmt(result.plant)}</div>
                    <span className="ait-result-severity-badge"
                      style={{ background: conf.light, color: conf.color }}>{conf.label}</span>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="ait-confidence-box">
                  <div className="ait-confidence-row">
                    <span>Confidence Score</span>
                    <span className="ait-confidence-score" style={{ color: conf.color }}>
                      {result.confidence?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="ait-confidence-track">
                    <div className="ait-confidence-fill" style={{
                      width: animateBar ? `${Math.min(result.confidence, 100)}%` : '0%',
                      background: `linear-gradient(90deg, ${conf.color}, ${conf.color}cc)`,
                    }} />
                  </div>
                  <div className="ait-confidence-scale">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>

                {/* Model message */}
                {result.message && (
                  <div className="ait-action-box" style={{ background: conf.light, border: `1px solid ${conf.color}20` }}>
                    <div className="ait-action-label" style={{ color: conf.color }}>
                      ℹ️ Model Note
                    </div>
                    <p className="ait-action-text" style={{ color: '#374151' }}>{result.message}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Top 3 predictions */}
            {result.top3?.length > 1 && (
              <div className="ait-predictions-card pi-top3-card">
                <div className="pi-top3-header">
                  <span>Top Matches</span>
                </div>
                <div className="ait-predictions-list" style={{ paddingTop: 12 }}>
                  {result.top3.map((p, i) => (
                    <div key={i} className="ait-pred-row">
                      <span className="ait-pred-rank" style={{
                        background: i === 0 ? '#dcfce7' : '#f9fafb',
                        color: i === 0 ? '#16a34a' : '#9ca3af',
                      }}>{i + 1}</span>
                      <span className="ait-pred-name" style={{
                        color: i === 0 ? '#111827' : '#4b5563',
                        fontWeight: i === 0 ? 700 : 500,
                      }}>{fmt(p.plant)}</span>
                      <div className="ait-pred-bar-track">
                        <div className="ait-pred-bar-fill" style={{
                          width: `${Math.min(p.confidence, 100)}%`,
                          background: i === 0 ? '#16a34a' : '#d1d5db',
                        }} />
                      </div>
                      <span className="ait-pred-pct" style={{
                        color: i === 0 ? '#16a34a' : '#6b7280',
                        fontWeight: i === 0 ? 700 : 500,
                      }}>{p.confidence?.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="ait-tip-box pi-tip-box">
              <span style={{ fontSize: 20, flexShrink: 0 }}>💬</span>
              <div>
                <strong>Want to know more?</strong>
                <p>Ask GreenBot (bottom-right) about this plant's uses, care, or medicinal properties.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Disease Detection Tool ───────────────────────────────────────────────────

function DiseaseDetector() {
  const [image,      setImage]      = useState(null);
  const [file,       setFile]       = useState(null);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [dragOver,   setDragOver]   = useState(false);
  const [showAll,    setShowAll]    = useState(false);
  const [animateBar, setAnimateBar] = useState(false);
  const inputRef = useRef();

  function handleFile(f) {
    if (!f?.type.startsWith('image/')) { setError('Please upload a valid image (JPG, PNG, WEBP).'); return; }
    if (f.size > 10 * 1024 * 1024)    { setError('File too large. Maximum 10 MB.'); return; }
    setFile(f); setImage(URL.createObjectURL(f));
    setResult(null); setError(''); setShowAll(false); setAnimateBar(false);
  }

  function onDrop(e) { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }

  async function detect() {
    if (!file) return;
    setLoading(true); setError(''); setResult(null); setAnimateBar(false);
    try {
      const form = new FormData();
      form.append('image', file);
      const res  = await fetch('/api/disease-detect', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Detection failed. Is the ML server running?');
      setResult(data);
      setTimeout(() => setAnimateBar(true), 100);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function reset() {
    setImage(null); setFile(null); setResult(null);
    setError(''); setShowAll(false); setAnimateBar(false);
  }

  const meta = result
    ? (DISEASE_META[result.disease] || { icon: '◉', color: '#16a34a', light: '#dcfce7', dark: '#14532d', label: 'Detected' })
    : null;

  return (
    <div className="ait-grid">
      {/* ── Left: Upload ─────────────────── */}
      <div>
        {!image ? (
          <div
            className={`ait-dropzone${dragOver ? ' drag-over' : ''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="ait-dropzone-icon">{dragOver ? '📂' : '📷'}</div>
            <h3>{dragOver ? 'Release to upload' : 'Upload leaf photo'}</h3>
            <p>Drag & drop or click to browse<br />JPG, PNG, WEBP — max 10 MB</p>
            <button className="ait-choose-btn">Choose File</button>
            <input ref={inputRef} type="file" accept="image/*"
              onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
          </div>
        ) : (
          <div className="ait-preview-card">
            <div className="ait-preview-img-wrap">
              <img src={image} alt="Leaf" className={loading ? 'loading' : ''} />
              {loading && (
                <>
                  <div className="ait-scan-line" />
                  <div className="ait-scan-overlay">
                    <div className="ait-scan-spinner" />
                    <div className="ait-scan-label">Analyzing leaf…</div>
                  </div>
                </>
              )}
              {result && (
                <div className="ait-complete-badge">
                  <div className="ait-complete-dot" />
                  <span>Analysis Complete</span>
                </div>
              )}
            </div>
            <div className="ait-preview-actions">
              {!result && !loading && (
                <button className="ait-btn-diagnose" onClick={detect}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Run Diagnosis
                </button>
              )}
              {(result || loading) && (
                <button className="ait-btn-secondary" onClick={reset}>← New Scan</button>
              )}
              {!result && !loading && (
                <button className="ait-btn-replace" onClick={() => inputRef.current.click()}>Replace</button>
              )}
              <input ref={inputRef} type="file" accept="image/*"
                onChange={e => handleFile(e.target.files[0])} style={{ display: 'none' }} />
            </div>
          </div>
        )}

        {error && <div className="ait-error"><strong>Error:</strong> {error}</div>}

        <div className="ait-conditions-box">
          <div className="ait-conditions-label">14 Detectable Conditions</div>
          <div className="ait-conditions-tags">
            {Object.keys(DISEASE_META).map(d => (
              <span key={d} className="ait-tag">{fmt(d)}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Results ───────────────── */}
      <div>
        {!result && !loading && !error && (
          <div className="ait-placeholder">
            <div className="ait-placeholder-icon">🔬</div>
            <h3>Awaiting Sample</h3>
            <p>Upload a clear photo of the affected plant leaf for diagnosis</p>
          </div>
        )}

        {loading && (
          <div className="ait-placeholder">
            <div className="ait-processing-spinner" />
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>Processing Image</div>
            <div style={{ color: '#6b7280', fontSize: 14 }}>Running through 14 disease classifiers…</div>
          </div>
        )}

        {result && meta && (
          <div className="ait-result-stack">
            <div className="ait-result-card" style={{
              border: `1.5px solid ${meta.color}30`,
              boxShadow: `0 8px 32px ${meta.color}12`,
            }}>
              <div className="ait-result-bar"
                style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}88)` }} />
              <div className="ait-result-body">
                <div className="ait-result-top">
                  <div className="ait-result-icon-wrap" style={{ background: meta.light }}>
                    <span style={{ fontSize: 24, color: meta.color }}>{meta.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="ait-result-label-small">Detected Condition</div>
                    <div className="ait-result-disease-name">{fmt(result.disease)}</div>
                    <span className="ait-result-severity-badge"
                      style={{ background: meta.light, color: meta.color }}>{meta.label}</span>
                  </div>
                </div>

                <div className="ait-confidence-box">
                  <div className="ait-confidence-row">
                    <span>Confidence Score</span>
                    <span className="ait-confidence-score" style={{ color: meta.color }}>
                      {result.confidence?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="ait-confidence-track">
                    <div className="ait-confidence-fill" style={{
                      width: animateBar ? `${Math.min(result.confidence, 100)}%` : '0%',
                      background: `linear-gradient(90deg, ${meta.color}, ${meta.color}cc)`,
                    }} />
                  </div>
                  <div className="ait-confidence-scale">
                    <span>0%</span><span>50%</span><span>100%</span>
                  </div>
                </div>

                {result.info && (
                  <div className="ait-action-box"
                    style={{ background: meta.light, border: `1px solid ${meta.color}20` }}>
                    <div className="ait-action-label" style={{ color: meta.color }}>⚡ Quick Action</div>
                    <p className="ait-action-text" style={{ color: meta.dark }}>{result.info}</p>
                  </div>
                )}
              </div>
            </div>

            {result.disease !== 'healthy' && (
              <InsightPanel disease={result.disease} meta={meta} />
            )}

            {result.allPredictions?.length > 1 && (
              <div className="ait-predictions-card">
                <button className="ait-predictions-toggle" onClick={() => setShowAll(p => !p)}>
                  <span>All Predictions ({result.allPredictions.length})</span>
                  <svg className={`ait-predictions-chevron${showAll ? ' open' : ''}`}
                    width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="#6b7280" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showAll && (
                  <div className="ait-predictions-list">
                    <div className="ait-predictions-divider" />
                    {result.allPredictions.slice(0, 7).map((p, i) => (
                      <div key={i} className="ait-pred-row">
                        <span className="ait-pred-rank" style={{
                          background: i === 0 ? '#dcfce7' : '#f9fafb',
                          color: i === 0 ? '#16a34a' : '#9ca3af',
                        }}>{i + 1}</span>
                        <span className="ait-pred-name" style={{
                          color: i === 0 ? '#111827' : '#4b5563',
                          fontWeight: i === 0 ? 700 : 500,
                        }}>{fmt(p.disease)}</span>
                        <div className="ait-pred-bar-track">
                          <div className="ait-pred-bar-fill" style={{
                            width: `${Math.min(p.confidence, 100)}%`,
                            background: i === 0 ? '#16a34a' : '#d1d5db',
                          }} />
                        </div>
                        <span className="ait-pred-pct" style={{
                          color: i === 0 ? '#16a34a' : '#6b7280',
                          fontWeight: i === 0 ? 700 : 500,
                        }}>{p.confidence?.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="ait-tip-box">
              <span style={{ fontSize: 20, flexShrink: 0 }}>💬</span>
              <div>
                <strong>Want more advice?</strong>
                <p>Click the green chat button (bottom-right) to ask GreenBot for detailed guidance.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main AITools Page ────────────────────────────────────────────────────────

const TABS = [
  {
    id: 'disease',
    label: 'Disease Detector',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: 'Plant Disease',
    titleAccent: 'Diagnostic Tool',
    desc: 'Upload a photo of a leaf. Our AI model — trained on 14 disease classes — will diagnose the condition and suggest treatment.',
  },
  {
    id: 'identify',
    label: 'Plant Identifier',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2a7 7 0 0 1 7 7c0 4-4 8-7 13C9 17 5 13 5 9a7 7 0 0 1 7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
    title: 'Ayurvedic Plant',
    titleAccent: 'Identifier',
    desc: 'Upload a photo of a plant. Our EfficientNetB0 model will identify the Ayurvedic or medicinal plant species from your image.',
  },
];

export default function AITools() {
  const [activeTab, setActiveTab] = useState('disease');
  const tab = TABS.find(t => t.id === activeTab);
  return (
    <div className="ait-page">
      <div className="ait-inner">

        {/* Tab switcher */}
        <div className="ait-tabs">
  {TABS.map(t => (
    <button
      key={t.id}
      className={`ait-tab-btn${activeTab === t.id ? ' active' : ''}`}
      onClick={() => setActiveTab(t.id)}
    >
      {t.label}
    </button>
  ))}
</div>

        {/* Hero — updates per tab */}
        <div className="ait-hero">
          <h1>{tab.title}<br /><span>{tab.titleAccent}</span></h1>
          <p>{tab.desc}</p>
        </div>

        {/* Tool content */}
        {activeTab === 'disease'  && <DiseaseDetector />}
        {activeTab === 'identify' && <PlantIdentifier />}

      </div>
      <FloatingChatbot />
    </div>
  );
}