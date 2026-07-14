import React, { useState } from 'react';
import PromptDiffViewer from './PromptDiffViewer';

const PROMPT_V1 = `You are a helpful customer support assistant for Acme Corp.

Your goal is to answer customer questions about orders.

Rules:
- Always be polite and professional.
- If you don't know the answer, say so.
- Never share internal pricing information.
- Respond in under 100 words.

When a customer asks about a refund, direct them to the refunds page.`;

const PROMPT_V2 = `You are a helpful customer support assistant for Acme Corp.

Your goal is to answer customer questions about orders, shipping, and returns.

Rules:
- Always be polite, professional, and concise.
- If you don't know the answer, escalate to a human agent.
- Never share internal pricing information.
- Respond in under 150 words.
- Use the customer's name when it is available.

When a customer asks about a refund, collect the order ID first,
then direct them to the refunds page.`;

export default function App() {
  const [oldText, setOldText] = useState(PROMPT_V1);
  const [newText, setNewText] = useState(PROMPT_V2);
  const [dark, setDark] = useState(false);
  const [merge, setMerge] = useState(null);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Prompt Diff Viewer</h1>
      <p style={{ color: '#666', marginTop: 0 }}>
        Edit either prompt below — the diff updates live.{' '}
        <label style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} /> Dark theme
        </label>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Prompt v1</label>
          <textarea
            value={oldText}
            onChange={(e) => setOldText(e.target.value)}
            rows={12}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginTop: 6, boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontWeight: 600, fontSize: 13 }}>Prompt v2</label>
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={12}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginTop: 6, boxSizing: 'border-box' }}
          />
        </div>
      </div>

      <PromptDiffViewer
        className={dark ? 'pdv-dark' : ''}
        oldText={oldText}
        newText={newText}
        oldLabel="Prompt v1"
        newLabel="Prompt v2"
        defaultView="split"
        onMergeChange={(mergedText, summary) => setMerge({ mergedText, summary })}
      />

      {merge && (
        <div style={{ marginTop: 20 }}>
          <label style={{ fontWeight: 600, fontSize: 13 }}>
            Merged result{' '}
            <span style={{ fontWeight: 400, color: '#666' }}>
              ({merge.summary.accepted} accepted, {merge.summary.rejected} rejected,{' '}
              {merge.summary.pending} pending)
            </span>
          </label>
          <textarea
            readOnly
            value={merge.mergedText}
            rows={12}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 12, marginTop: 6, boxSizing: 'border-box', background: '#fafafa' }}
          />
        </div>
      )}
    </div>
  );
}
