import { writeFileSync } from 'node:fs';

/**
 * Writes a check/audit result to disk for CI consumption, in addition to the
 * normal colored terminal output. JSON if the path ends in `.json`,
 * otherwise a simple indented plain-text dump.
 */
export function writeReport(outputPath: string, data: Record<string, unknown>): void {
  const isJson = outputPath.toLowerCase().endsWith('.json');
  const content = isJson ? JSON.stringify(data, null, 2) + '\n' : toPlainText(data);
  writeFileSync(outputPath, content, 'utf8');
}

function toPlainText(data: Record<string, unknown>, indent = ''): string {
  let out = '';
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      out += `${indent}${key}: ${value.length} item${value.length !== 1 ? 's' : ''}\n`;
      for (const item of value) {
        out += `${indent}  - ${typeof item === 'object' ? JSON.stringify(item) : String(item)}\n`;
      }
    } else if (value && typeof value === 'object') {
      out += `${indent}${key}:\n${toPlainText(value as Record<string, unknown>, indent + '  ')}`;
    } else {
      out += `${indent}${key}: ${String(value)}\n`;
    }
  }
  return out;
}
