import React, { useRef, useCallback, useEffect, useState } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered,
  Heading1, Heading2, Heading3, Type, Table, Plus,
  ChevronDown,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = '150px' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [hoverRow, setHoverRow] = useState(0);
  const [hoverCol, setHoverCol] = useState(0);
  const [useCustomSize, setUseCustomSize] = useState(false);
  const tableMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCommand = useCallback((cmd: string) => {
    editorRef.current?.focus();
    if (cmd.startsWith('formatBlock:')) {
      document.execCommand('formatBlock', false, cmd.split(':')[1]);
    } else {
      document.execCommand(cmd, false);
    }
    emitChange();
  }, [emitChange]);

  const handleInput = useCallback(() => emitChange(), [emitChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // ── Table operations ──────────────────────────────────────────────────────
  const insertTable = useCallback(() => {
    const r = Math.max(1, tableRows);
    const c = Math.max(1, tableCols);
    const headerCells = Array.from({ length: c }, (_, i) => `<th>Header ${i + 1}</th>`).join('');
    const bodyCells = Array.from({ length: c }, () => '<td>&nbsp;</td>').join('');
    const bodyRows = Array.from({ length: r - 1 }, () => `<tr>${bodyCells}</tr>`).join('');
    const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`;
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    emitChange();
    setShowTableMenu(false);
  }, [tableRows, tableCols, emitChange]);

  const insertTableWithSize = useCallback((rows: number, cols: number) => {
    const r = Math.max(1, rows);
    const c = Math.max(1, cols);
    const headerCells = Array.from({ length: c }, (_, i) => `<th>Header ${i + 1}</th>`).join('');
    const bodyCells = Array.from({ length: c }, () => '<td>&nbsp;</td>').join('');
    const bodyRows = Array.from({ length: r - 1 }, () => `<tr>${bodyCells}</tr>`).join('');
    const html = `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`;
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    emitChange();
    setShowTableMenu(false);
  }, [emitChange]);

  const findParentTable = (): HTMLTableElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLTableElement) return node;
      node = node.parentNode;
    }
    return null;
  };

  const findParentRow = (): HTMLTableRowElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLTableRowElement) return node;
      node = node.parentNode;
    }
    return null;
  };

  const findParentCell = (): HTMLTableCellElement | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    let node: Node | null = sel.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLTableCellElement) return node;
      node = node.parentNode;
    }
    return null;
  };

  const addTableRow = useCallback(() => {
    const table = findParentTable();
    if (!table) return;
    const tbody = table.querySelector('tbody') || table;
    const cols = (table.querySelector('tr')?.children.length) || 1;
    const tr = document.createElement('tr');
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td');
      td.innerHTML = '&nbsp;';
      tr.appendChild(td);
    }
    const currentRow = findParentRow();
    if (currentRow && currentRow.parentNode === tbody) {
      currentRow.after(tr);
    } else {
      tbody.appendChild(tr);
    }
    emitChange();
  }, [emitChange]);

  const addTableCol = useCallback(() => {
    const table = findParentTable();
    if (!table) return;
    const currentCell = findParentCell();
    const cellIndex = currentCell ? currentCell.cellIndex + 1 : -1;
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      const isHeader = row.parentElement?.tagName === 'THEAD';
      const cell = document.createElement(isHeader ? 'th' : 'td');
      cell.innerHTML = isHeader ? 'Header' : '&nbsp;';
      if (cellIndex >= 0 && cellIndex < row.children.length) {
        row.children[cellIndex].after(cell);
      } else {
        row.appendChild(cell);
      }
    });
    emitChange();
  }, [emitChange]);

  const deleteTableRow = useCallback(() => {
    const row = findParentRow();
    if (!row) return;
    const table = findParentTable();
    if (!table) return;
    const allRows = table.querySelectorAll('tr');
    if (allRows.length <= 1) {
      table.remove();
    } else {
      row.remove();
    }
    emitChange();
  }, [emitChange]);

  const deleteTableCol = useCallback(() => {
    const cell = findParentCell();
    if (!cell) return;
    const table = findParentTable();
    if (!table) return;
    const colIdx = cell.cellIndex;
    const rows = table.querySelectorAll('tr');
    const totalCols = rows[0]?.children.length || 0;
    if (totalCols <= 1) {
      table.remove();
    } else {
      rows.forEach(row => {
        if (row.children[colIdx]) row.children[colIdx].remove();
      });
    }
    emitChange();
  }, [emitChange]);

  const deleteTable = useCallback(() => {
    const table = findParentTable();
    if (table) {
      table.remove();
      emitChange();
    }
  }, [emitChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      const cell = findParentCell();
      if (cell) {
        e.preventDefault();
        const row = cell.parentElement as HTMLTableRowElement;
        const nextCell = e.shiftKey
          ? cell.previousElementSibling as HTMLTableCellElement
          : cell.nextElementSibling as HTMLTableCellElement;
        if (nextCell) {
          const range = document.createRange();
          range.selectNodeContents(nextCell);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } else if (!e.shiftKey) {
          const nextRow = row.nextElementSibling as HTMLTableRowElement;
          if (nextRow?.firstElementChild) {
            const range = document.createRange();
            range.selectNodeContents(nextRow.firstElementChild);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }
      }
    }
  }, []);

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>';

  return (
    <div className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500 relative">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-wrap rounded-t-lg">
        <ToolBtn icon={Bold} label="Bold" onAction={() => execCommand('bold')} />
        <ToolBtn icon={Italic} label="Italic" onAction={() => execCommand('italic')} />
        <ToolBtn icon={Underline} label="Underline" onAction={() => execCommand('underline')} />
        <Divider />
        <ToolBtn icon={Heading1} label="Heading 1" onAction={() => execCommand('formatBlock:h1')} />
        <ToolBtn icon={Heading2} label="Heading 2" onAction={() => execCommand('formatBlock:h2')} />
        <ToolBtn icon={Heading3} label="Heading 3" onAction={() => execCommand('formatBlock:h3')} />
        <ToolBtn icon={Type} label="Normal text" onAction={() => execCommand('formatBlock:p')} />
        <Divider />
        <ToolBtn icon={List} label="Bullet list" onAction={() => execCommand('insertUnorderedList')} />
        <ToolBtn icon={ListOrdered} label="Numbered list" onAction={() => execCommand('insertOrderedList')} />
        <Divider />

        {/* Table dropdown */}
        <div className="relative" ref={tableMenuRef}>
          <button
            type="button"
            title="Insert table"
            onMouseDown={e => { e.preventDefault(); setShowTableMenu(v => !v); setUseCustomSize(false); setHoverRow(0); setHoverCol(0); }}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-0.5"
          >
            <Table className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </button>
          {showTableMenu && (
            <div
              className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-3 z-[9999] min-w-[220px]"
              onMouseDown={e => e.preventDefault()}
              style={{ maxHeight: '400px', overflowY: 'auto' }}
            >
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-100 mb-2">Insert Table</p>

              {!useCustomSize ? (
                <>
                  {/* Visual grid selector: 8x6 grid */}
                  <div className="mb-1">
                    <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `repeat(8, 1fr)` }}>
                      {Array.from({ length: 6 * 8 }, (_, i) => {
                        const r = Math.floor(i / 8) + 1;
                        const c = (i % 8) + 1;
                        const isHighlighted = r <= (hoverRow || 0) && c <= (hoverCol || 0);
                        return (
                          <div
                            key={i}
                            onMouseEnter={() => { setHoverRow(r); setHoverCol(c); }}
                            onClick={() => { setTableRows(r); setTableCols(c); insertTableWithSize(r, c); }}
                            className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                              isHighlighted
                                ? 'bg-green-500 border-green-600'
                                : 'bg-slate-50 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1.5 text-center font-medium">
                      {hoverRow > 0 && hoverCol > 0
                        ? `${hoverRow} × ${hoverCol} table`
                        : 'Hover to select size'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCustomSize(true)}
                    className="w-full text-xs text-green-600 dark:text-emerald-300 hover:text-green-800 dark:hover:text-emerald-200 hover:bg-green-50 dark:hover:bg-emerald-900/25 py-1.5 rounded font-medium mt-1"
                  >
                    Custom size...
                  </button>
                </>
              ) : (
                <>
                  {/* Manual row/col input */}
                  <div className="flex items-center gap-2 mb-2">
                    <label htmlFor="table-rows" className="text-xs text-slate-500 dark:text-slate-300 w-10">Rows</label>
                    <input id="table-rows" name="tableRows" type="number" min={1} max={50} value={tableRows}
                      onChange={e => setTableRows(Math.max(1, Number(e.target.value)))}
                      className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <label htmlFor="table-cols" className="text-xs text-slate-500 dark:text-slate-300 w-10">Cols</label>
                    <input id="table-cols" name="tableCols" type="number" min={1} max={20} value={tableCols}
                      onChange={e => setTableCols(Math.max(1, Number(e.target.value)))}
                      className="flex-1 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-green-500 focus:border-green-500" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setUseCustomSize(false)}
                      className="flex-1 px-2 py-1.5 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200 text-xs font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-700">
                      Grid
                    </button>
                    <button type="button" onClick={insertTable}
                      className="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md flex items-center justify-center gap-1">
                      <Plus className="h-3 w-3" /> Insert
                    </button>
                  </div>
                </>
              )}

              <div className="border-t border-slate-200 dark:border-slate-700 mt-2.5 pt-2 space-y-0.5">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">Edit existing table:</p>
                <SmallBtn label="+ Add Row" onClick={addTableRow} />
                <SmallBtn label="+ Add Column" onClick={addTableCol} />
                <SmallBtn label="− Delete Row" onClick={deleteTableRow} variant="red" />
                <SmallBtn label="− Delete Column" onClick={deleteTableCol} variant="red" />
                <SmallBtn label="Delete Entire Table" onClick={deleteTable} variant="red" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="relative">
        {isEmpty && placeholder && (
          <div className="absolute top-0 left-0 px-3 py-2 text-sm text-slate-400 dark:text-slate-500 pointer-events-none">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onClick={() => setShowTableMenu(false)}
          className={`px-3 py-2 text-sm text-slate-700 dark:text-slate-100 outline-none prose prose-sm max-w-none dark:prose-invert ${EDITOR_STYLES}`}
          style={{ minHeight }}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}

// ── Small helper components ─────────────────────────────────────────────────

function ToolBtn({ icon: Icon, label, onAction }: { icon: React.ComponentType<{ className?: string }>; label: string; onAction: () => void }) {
  return (
    <button type="button" title={label} onMouseDown={e => { e.preventDefault(); onAction(); }}
      className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors">
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() { return <div className="w-px h-5 bg-slate-300 dark:bg-slate-600 mx-1" />; }

function SmallBtn({ label, onClick, variant = 'default' }: { label: string; onClick: () => void; variant?: 'default' | 'red' }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left text-xs px-2 py-1 rounded ${variant === 'red' ? 'text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
      {label}
    </button>
  );
}

// ── Shared Tailwind classes for rendered content ────────────────────────────

const EDITOR_STYLES = [
  '[&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1',
  '[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1',
  '[&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-0.5',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1',
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1',
  '[&_li]:my-0.5 [&_p]:my-1',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:border [&_table]:border-slate-400 dark:[&_table]:border-slate-500',
  '[&_th]:border [&_th]:border-slate-400 dark:[&_th]:border-slate-500 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-700 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-slate-700 dark:[&_th]:text-slate-100',
  '[&_td]:border [&_td]:border-slate-400 dark:[&_td]:border-slate-500 [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-sm',
].join(' ');

export const RICH_CONTENT_STYLES = `prose prose-sm max-w-none text-slate-600 leading-relaxed ${EDITOR_STYLES}`;

export const RICH_CONTENT_STYLES_LG = [
  'prose prose-base max-w-none text-slate-700 leading-relaxed',
  '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2',
  '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5',
  '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2.5 [&_h3]:mb-1',
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
  '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
  '[&_li]:my-1 [&_p]:my-2',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:my-4',
  '[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-4 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_th]:text-slate-700',
  '[&_td]:border [&_td]:border-slate-300 [&_td]:px-4 [&_td]:py-2 [&_td]:text-base',
].join(' ');

// ── Sanitiser ──────────────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h1', 'h2', 'h3',
  'ul', 'ol', 'li', 'div', 'span',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const clean = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(clean).join('');
    if (ALLOWED_TAGS.has(tag)) return `<${tag}>${inner}</${tag}>`;
    return inner;
  };
  return Array.from(doc.body.childNodes).map(clean).join('');
}
