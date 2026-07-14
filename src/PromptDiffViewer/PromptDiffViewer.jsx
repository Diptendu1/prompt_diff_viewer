import React, { useEffect, useMemo, useState } from 'react';
import { diffLines, diffStats, assignHunks, buildMergedText } from './diff.js';
import './PromptDiffViewer.css';

/**
 * PromptDiffViewer — a drop-in React component for comparing two versions of
 * a prompt (or any text), with per-change accept/reject controls.
 *
 * Props:
 *   oldText      (string, required)  — the previous prompt version
 *   newText      (string, required)  — the current prompt version
 *   oldLabel     (string)            — header label for the old side, default "Before"
 *   newLabel     (string)            — header label for the new side, default "After"
 *   defaultView  ('split' | 'unified') — initial layout, default 'split'
 *   showToolbar  (boolean)           — render the header bar, default true
 *   showActions  (boolean)           — per-change Accept/Reject buttons, default true
 *   hideUnchanged (boolean)          — initial state of the "hide unchanged" toggle, default false
 *   contextLines (number)            — unchanged lines kept around changes when hiding, default 2
 *   className    (string)            — extra class on the root element
 *   onMergeChange (fn)               — called after every decision with
 *                                      (mergedText, { accepted, rejected, pending, decisions })
 */
export default function PromptDiffViewer({
  oldText = '',
  newText = '',
  oldLabel = 'Before',
  newLabel = 'After',
  defaultView = 'split',
  showToolbar = true,
  showActions = true,
  hideUnchanged: hideUnchangedDefault = false,
  contextLines = 2,
  className = '',
  onMergeChange,
}) {
  const [view, setView] = useState(defaultView);
  const [hideUnchanged, setHideUnchanged] = useState(hideUnchangedDefault);
  const [decisions, setDecisions] = useState({});

  const { rows, hunkCount } = useMemo(
    () => assignHunks(diffLines(oldText, newText)),
    [oldText, newText]
  );
  const stats = useMemo(() => diffStats(rows), [rows]);

  // Texts changed → previous decisions no longer apply.
  useEffect(() => {
    setDecisions({});
  }, [oldText, newText]);

  const visibleRows = useMemo(() => {
    if (!hideUnchanged) return rows;
    return collapseUnchanged(rows, contextLines);
  }, [rows, hideUnchanged, contextLines]);

  const hasChanges = stats.additions > 0 || stats.deletions > 0;
  const decidedCount = Object.keys(decisions).length;
  const pendingCount = hunkCount - decidedCount;

  const applyDecisions = (next) => {
    setDecisions(next);
    if (onMergeChange) {
      const accepted = Object.values(next).filter((d) => d === 'accepted').length;
      const rejected = Object.values(next).filter((d) => d === 'rejected').length;
      onMergeChange(buildMergedText(rows, next), {
        accepted,
        rejected,
        pending: hunkCount - accepted - rejected,
        decisions: next,
      });
    }
  };

  const decide = (hunk, decision) => {
    const next = { ...decisions };
    if (decision === null) delete next[hunk];
    else next[hunk] = decision;
    applyDecisions(next);
  };

  const decideAll = (decision) => {
    const next = {};
    if (decision !== null) {
      for (let h = 0; h < hunkCount; h++) next[h] = decision;
    }
    applyDecisions(next);
  };

  const hunkProps = { showActions, decisions, decide };

  return (
    <div className={`pdv ${className}`}>
      {showToolbar && (
        <div className="pdv-toolbar">
          <div className="pdv-stats">
            {hasChanges ? (
              <>
                <span className="pdv-stat pdv-stat-add">+{stats.additions}</span>
                <span className="pdv-stat pdv-stat-del">−{stats.deletions}</span>
                {showActions && (
                  <span className="pdv-stat pdv-stat-same">
                    {pendingCount === 0
                      ? 'All changes reviewed'
                      : `${pendingCount} of ${hunkCount} change${hunkCount === 1 ? '' : 's'} pending`}
                  </span>
                )}
              </>
            ) : (
              <span className="pdv-stat pdv-stat-same">No changes</span>
            )}
          </div>
          <div className="pdv-controls">
            {showActions && hasChanges && (
              <div className="pdv-bulk">
                <button type="button" className="pdv-btn pdv-btn-accept" onClick={() => decideAll('accepted')}>
                  ✓ Accept all
                </button>
                <button type="button" className="pdv-btn pdv-btn-reject" onClick={() => decideAll('rejected')}>
                  ✕ Reject all
                </button>
                {decidedCount > 0 && (
                  <button type="button" className="pdv-btn" onClick={() => decideAll(null)}>
                    Reset
                  </button>
                )}
              </div>
            )}
            <label className="pdv-toggle">
              <input
                type="checkbox"
                checked={hideUnchanged}
                onChange={(e) => setHideUnchanged(e.target.checked)}
              />
              Hide unchanged
            </label>
            <div className="pdv-view-switch" role="tablist" aria-label="Diff layout">
              <button
                type="button"
                role="tab"
                aria-selected={view === 'split'}
                className={view === 'split' ? 'active' : ''}
                onClick={() => setView('split')}
              >
                Split
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === 'unified'}
                className={view === 'unified' ? 'active' : ''}
                onClick={() => setView('unified')}
              >
                Unified
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'split' ? (
        <SplitView rows={visibleRows} oldLabel={oldLabel} newLabel={newLabel} {...hunkProps} />
      ) : (
        <UnifiedView rows={visibleRows} {...hunkProps} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Replace long runs of 'equal' rows with a single collapse marker row. */
function collapseUnchanged(rows, contextLines) {
  const keep = new Array(rows.length).fill(false);
  rows.forEach((row, i) => {
    if (row.type === 'equal') return;
    for (
      let j = Math.max(0, i - contextLines);
      j <= Math.min(rows.length - 1, i + contextLines);
      j++
    ) {
      keep[j] = true;
    }
  });

  const out = [];
  let hidden = 0;
  const flush = () => {
    if (hidden > 0) {
      out.push({ type: 'collapsed', count: hidden });
      hidden = 0;
    }
  };
  rows.forEach((row, i) => {
    if (keep[i]) {
      flush();
      out.push(row);
    } else {
      hidden++;
    }
  });
  flush();
  return out;
}

function Segments({ segments, plain }) {
  if (!segments) return <>{plain}</>;
  return (
    <>
      {segments.map((seg, i) =>
        seg.type === 'equal' ? (
          <React.Fragment key={i}>{seg.value}</React.Fragment>
        ) : (
          <mark key={i} className={seg.type === 'add' ? 'pdv-mark-add' : 'pdv-mark-del'}>
            {seg.value}
          </mark>
        )
      )}
    </>
  );
}

function CollapsedRow({ count, colSpan }) {
  return (
    <tr className="pdv-row-collapsed">
      <td colSpan={colSpan}>⋯ {count} unchanged line{count === 1 ? '' : 's'} hidden ⋯</td>
    </tr>
  );
}

/** Accept/Reject bar shown above the first row of each hunk. */
function HunkBar({ hunk, decisions, decide, colSpan }) {
  const decision = decisions[hunk];
  return (
    <tr className="pdv-hunk-bar">
      <td colSpan={colSpan}>
        <div className="pdv-hunk-actions">
          <span className="pdv-hunk-label">Change {hunk + 1}</span>
          {decision ? (
            <>
              <span className={`pdv-chip ${decision === 'accepted' ? 'pdv-chip-accept' : 'pdv-chip-reject'}`}>
                {decision === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
              </span>
              <button type="button" className="pdv-btn" onClick={() => decide(hunk, null)}>
                Undo
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pdv-btn pdv-btn-accept"
                onClick={() => decide(hunk, 'accepted')}
              >
                ✓ Accept
              </button>
              <button
                type="button"
                className="pdv-btn pdv-btn-reject"
                onClick={() => decide(hunk, 'rejected')}
              >
                ✕ Reject
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/** Class applied to every row of a decided hunk. */
function hunkStateClass(row, decisions) {
  if (row.hunk == null) return '';
  const d = decisions[row.hunk];
  if (d === 'accepted') return 'pdv-hunk-accepted';
  if (d === 'rejected') return 'pdv-hunk-rejected';
  return '';
}

/** True when this row starts a new hunk relative to the previous visible row. */
function startsHunk(rows, i) {
  const row = rows[i];
  if (row.hunk == null) return false;
  const prev = rows[i - 1];
  return !prev || prev.hunk !== row.hunk;
}

function SplitView({ rows, oldLabel, newLabel, showActions, decisions, decide }) {
  return (
    <div className="pdv-scroll">
      <table className="pdv-table pdv-split">
        <colgroup>
          <col className="pdv-col-num" />
          <col className="pdv-col-text" />
          <col className="pdv-col-num" />
          <col className="pdv-col-text" />
        </colgroup>
        <thead>
          <tr>
            <th colSpan={2}>{oldLabel}</th>
            <th colSpan={2}>{newLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.type === 'collapsed') {
              return <CollapsedRow key={i} count={row.count} colSpan={4} />;
            }
            const leftClass =
              row.type === 'equal' ? '' : row.oldLine === null ? 'pdv-cell-empty' : 'pdv-cell-del';
            const rightClass =
              row.type === 'equal' ? '' : row.newLine === null ? 'pdv-cell-empty' : 'pdv-cell-add';
            const stateClass = hunkStateClass(row, decisions);
            return (
              <React.Fragment key={i}>
                {showActions && startsHunk(rows, i) && (
                  <HunkBar hunk={row.hunk} decisions={decisions} decide={decide} colSpan={4} />
                )}
                <tr className={stateClass}>
                  <td className={`pdv-num ${leftClass}`}>{row.oldNumber ?? ''}</td>
                  <td className={`pdv-text ${leftClass}`}>
                    {row.oldLine !== null && (
                      <Segments segments={row.oldSegments} plain={row.oldLine} />
                    )}
                  </td>
                  <td className={`pdv-num ${rightClass}`}>{row.newNumber ?? ''}</td>
                  <td className={`pdv-text ${rightClass}`}>
                    {row.newLine !== null && (
                      <Segments segments={row.newSegments} plain={row.newLine} />
                    )}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UnifiedView({ rows, showActions, decisions, decide }) {
  const lines = [];
  rows.forEach((row, i) => {
    if (row.type === 'collapsed') {
      lines.push({ key: `c${i}`, kind: 'collapsed', count: row.count });
      return;
    }
    const starts = startsHunk(rows, i);
    if (row.type === 'equal') {
      lines.push({
        key: `e${i}`, kind: 'equal', sign: ' ', hunk: null, starts: false,
        oldNumber: row.oldNumber, newNumber: row.newNumber, content: row.oldLine,
      });
      return;
    }
    // 'remove', 'add', and 'modify' all become -/+ line pairs in unified view.
    if (row.oldLine !== null) {
      lines.push({
        key: `d${i}`, kind: 'del', sign: '−', hunk: row.hunk, starts,
        oldNumber: row.oldNumber, newNumber: null,
        content: row.oldLine, segments: row.oldSegments,
        stateClass: hunkStateClass(row, decisions),
      });
    }
    if (row.newLine !== null) {
      lines.push({
        key: `a${i}`, kind: 'add', sign: '+', hunk: row.hunk,
        starts: starts && row.oldLine === null,
        oldNumber: null, newNumber: row.newNumber,
        content: row.newLine, segments: row.newSegments,
        stateClass: hunkStateClass(row, decisions),
      });
    }
  });

  return (
    <div className="pdv-scroll">
      <table className="pdv-table pdv-unified">
        <colgroup>
          <col className="pdv-col-num" />
          <col className="pdv-col-num" />
          <col className="pdv-col-sign" />
          <col className="pdv-col-text" />
        </colgroup>
        <tbody>
          {lines.map((line) => {
            if (line.kind === 'collapsed') {
              return <CollapsedRow key={line.key} count={line.count} colSpan={4} />;
            }
            const cls =
              line.kind === 'del' ? 'pdv-cell-del' : line.kind === 'add' ? 'pdv-cell-add' : '';
            return (
              <React.Fragment key={line.key}>
                {showActions && line.starts && (
                  <HunkBar hunk={line.hunk} decisions={decisions} decide={decide} colSpan={4} />
                )}
                <tr className={line.stateClass || ''}>
                  <td className={`pdv-num ${cls}`}>{line.oldNumber ?? ''}</td>
                  <td className={`pdv-num ${cls}`}>{line.newNumber ?? ''}</td>
                  <td className={`pdv-sign ${cls}`}>{line.sign}</td>
                  <td className={`pdv-text ${cls}`}>
                    <Segments segments={line.segments} plain={line.content} />
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
