import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  processRows,
  OUT_SKILL_COL,
  OUT_CORE_COL,
} from "./processing.js";

export default function App() {
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [removeE0, setRemoveE0] = useState(true);
  const [addPriority, setAddPriority] = useState(true);
  const inputRef = useRef(null);

  const readFile = useCallback((file) => {
    setError("");
    setResult(null);
    setRawRows(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (!rows.length) {
          setError("The first sheet appears to be empty.");
          return;
        }
        setRawRows(rows);
      } catch (err) {
        setError(`Could not read file: ${err.message}`);
      }
    };
    reader.onerror = () => setError("Failed to read the file.");
    reader.readAsArrayBuffer(file);
  }, []);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  };

  const process = () => {
    setError("");
    if (!rawRows) return;
    if (!removeE0 && !addPriority) {
      setError("Select at least one operation.");
      return;
    }
    try {
      const res = processRows(rawRows, { removeE0, addPriority });
      setResult(res);
    } catch (err) {
      setError(err.message);
    }
  };

  const download = (mappedOnly = false) => {
    if (!result) return;
    const rows = mappedOnly
      ? result.rows.filter((r) => String(r[OUT_CORE_COL] ?? "").trim() !== "")
      : result.rows;
    if (!rows.length) {
      setError("No rows have a mapped core skill to export.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows, { header: result.columns });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Output");
    const base = fileName.replace(/\.[^.]+$/, "") || "output";
    const suffix = mappedOnly ? "_mapped" : "_processed";
    XLSX.writeFile(wb, `${base}${suffix}.xlsx`);
  };

  const preview = useMemo(() => {
    if (!result) return null;
    return result.rows.slice(0, 20);
  }, [result]);

  const newCols = useMemo(
    () => new Set([OUT_SKILL_COL, OUT_CORE_COL]),
    []
  );

  return (
    <div className="app">
      <div className="header">
        <h1>Skill Mapper</h1>
        <p>
          Upload a candidate Excel file to remove <code>[ E0 ]</code>{" "}
          competencies and/or add the highest-priority skill and its mapped core
          skill. Everything runs locally in your browser.
        </p>
      </div>

      <div className="panel">
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div>
            <strong>Click to browse</strong> or drag &amp; drop an .xlsx / .xls
            file here
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={onFileChange}
          />
        </div>
        {fileName && (
          <div className="file-info">
            <span>
              Loaded: <strong>{fileName}</strong>
              {rawRows ? ` (${rawRows.length} rows)` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="options">
          <label className="option">
            <input
              type="checkbox"
              checked={removeE0}
              onChange={(e) => setRemoveE0(e.target.checked)}
            />
            <span>
              <div className="title">Remove E0 competencies</div>
              <div className="desc">
                Drops any <code>[ E0 ... ]</code> skill from Primary &amp;
                Secondary and cleans up semicolons.
              </div>
            </span>
          </label>
          <label className="option">
            <input
              type="checkbox"
              checked={addPriority}
              onChange={(e) => setAddPriority(e.target.checked)}
            />
            <span>
              <div className="title">Add priority skill columns</div>
              <div className="desc">
                Adds highest-priority detailed skillset (Primary wins ties) and
                its mapped core skill.
              </div>
            </span>
          </label>
        </div>

        <div className="actions" style={{ marginTop: 18 }}>
          <button
            className="btn-primary"
            onClick={process}
            disabled={!rawRows}
          >
            Process
          </button>
          <button
            className="btn-secondary"
            onClick={() => download(false)}
            disabled={!result}
          >
            Download all rows
          </button>
          <button
            className="btn-secondary"
            onClick={() => download(true)}
            disabled={!result || !addPriority}
            title="Only rows where Mapped Core Skill is filled"
          >
            Download mapped only
          </button>
        </div>

        {error && <div className="error">{error}</div>}
      </div>

      {result && (
        <div className="panel">
          <div className="stats">
            <div className="stat">
              <div className="num">{result.stats.rowsProcessed}</div>
              <div className="label">Rows processed</div>
            </div>
            <div className="stat">
              <div className="num" style={{ fontSize: 14 }}>
                {result.stats.primaryCol}
              </div>
              <div className="label">Detected primary column</div>
            </div>
            <div className="stat">
              <div className="num" style={{ fontSize: 14 }}>
                {result.stats.secondaryCol}
              </div>
              <div className="label">Detected secondary column</div>
            </div>
            {addPriority && (
              <>
                <div className="stat">
                  <div className="num">{result.stats.mapped}</div>
                  <div className="label">Mapped to core skill</div>
                </div>
                <div className="stat">
                  <div className="num">{result.stats.unmapped}</div>
                  <div className="label">No mapping found</div>
                </div>
              </>
            )}
          </div>

          <p className="muted" style={{ marginTop: 16 }}>
            Preview (first {preview.length} rows):
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {result.columns.map((c) => (
                    <th key={c} className={newCols.has(c) ? "col-new" : ""}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {result.columns.map((c) => (
                      <td key={c} className={newCols.has(c) ? "col-new" : ""}>
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
