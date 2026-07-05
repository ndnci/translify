import { c } from './colors.js';

export interface TableColumn {
  header: string;
  /** Optional colorizer applied to each cell in this column */
  color?: (value: string) => string;
}

/**
 * Renders a small column-aligned table for terminal output, e.g.:
 *
 *   Check          Issues
 *   ─────────────  ──────
 *   Missing keys        3
 *   Unused keys          0
 */
export function renderTable(columns: TableColumn[], rows: string[][]): string {
  const widths = columns.map((col, i) =>
    Math.max(col.header.length, ...rows.map((row) => (row[i] ?? '').length)),
  );

  const headerLine = columns.map((col, i) => c.bold(col.header.padEnd(widths[i]!))).join('  ');
  const separatorLine = widths.map((w) => c.dim('─'.repeat(w))).join('  ');
  const rowLines = rows.map((row) =>
    row
      .map((cell, i) => {
        const padded = cell.padEnd(widths[i]!);
        return columns[i]?.color ? columns[i]!.color!(padded) : padded;
      })
      .join('  '),
  );

  return [headerLine, separatorLine, ...rowLines].join('\n');
}
