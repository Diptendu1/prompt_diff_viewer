import React, { useMemo, useState } from 'react';
import { diffLines, diffStats } from './diff.js';
import './PromptDiffViewer.css';

/**
 * PromptDiffViewer — a drop-in React component for comparing two versions of
 * a prompt (or any text).
 *
 * Props:
 *   oldText      (string, required)  — the previous prompt version
 *   newText      (string, required)  — the current prompt version
 *   oldLabel     (string)            — header label for the old side, default "Before"
 *   newLabel     (string)            — header label for the new side, default "After"
 *   defaultView  ('split' | 'unified') — initial layout, default 'split'
 *   showToolbar  (boolean)           — render the header bar, default true
 *   hideUnchanged (boolean)          — initial state of the "hide unchanged" toggle, default false
 *   contextLines (number)            — unchanged lines kept around changes when hiding, default 2
 *   className    (string)            — extra class on the root element
 */
export default function PromptDiffViewer({
  oldText = '',
  newText = '',
  oldLabel = 'Before',
  newLabel = 'After',
  defaultView = 'split',
  showToolbar = true,
  hideUnchanged: hideUnchangedDefault = false,
  contextLines = 2,
  className = '',
}) {
  const [view, setView] = useState(defaultView);
  const [hideUnchanged, setHideUnchanged] = useState(hideUnchangedDefault);

  const rows = useMemo(() => diffLines(oldText, newText), [oldText, newText]);
  const stats = useMemo(() => diffStats(rows), [rows]);

  const visibleRows = useMemo(() => {
    if (!hideUnchanged) return rows;
    return collapseUnchanged(rows, contextLines);
  }, [rows, hideUnchanged, contextLines]);

  const hasChanges = stats.additions > 0 || stats.deletions > 0;

  return (
    <div className={`pdv ${className}`}>
      {showToolbar && (
        <div className="pdv-toolbar">
          <div className="pdv-stats">
            {hasChanges ? (
              <>
                <span className="pdv-stat pdv-stat-add">+{stats.additions}</span>
                <span className="pdv-stat pdv-stat-del">−{stats.deletions}</span>
              </>
            ) : (
              <span className="pdv-stat pdv-stat-same">No changes</span>
            )}
          </div>
          <div className="pdv-controls">
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
        <SplitView rows={visibleRows} oldLabel={oldLabel} newLabel={newLabel} />
      ) : (
        <UnifiedView rows={visibleRows} />
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

function SplitView({ rows, oldLabel, newLabel }) {
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
            return (
              <tr key={i}>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UnifiedView({ rows }) {
  const lines = [];
  rows.forEach((row, i) => {
    if (row.type === 'collapsed') {
      lines.push({ key: `c${i}`, kind: 'collapsed', count: row.count });
      return;
    }
    if (row.type === 'equal') {
      lines.push({
        key: `e${i}`, kind: 'equal', sign: ' ',
        oldNumber: row.oldNumber, newNumber: row.newNumber, content: row.oldLine,
      });
      return;
    }
    // 'remove', 'add', and 'modify' all become -/+ line pairs in unified view.
    if (row.oldLine !== null) {
      lines.push({
        key: `d${i}`, kind: 'del', sign: '−',
        oldNumber: row.oldNumber, newNumber: null,
        content: row.oldLine, segments: row.oldSegments,
      });
    }
    if (row.newLine !== null) {
      lines.push({
        key: `a${i}`, kind: 'add', sign: '+',
        oldNumber: null, newNumber: row.newNumber,
        content: row.newLine, segments: row.newSegments,
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
              <tr key={line.key}>
                <td className={`pdv-num ${cls}`}>{line.oldNumber ?? ''}</td>
                <td className={`pdv-num ${cls}`}>{line.newNumber ?? ''}</td>
                <td className={`pdv-sign ${cls}`}>{line.sign}</td>
                <td className={`pdv-text ${cls}`}>
                  <Segments segments={line.segments} plain={line.content} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
