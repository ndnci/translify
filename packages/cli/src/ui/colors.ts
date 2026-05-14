import chalk from 'chalk';

// ─── Color palette ─────────────────────────────────────────────────────────────

export const c = {
  // Brand
  brand: chalk.hex('#0070f3').bold,
  brandDim: chalk.hex('#0070f3'),

  // Semantics
  success: chalk.green,
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  dim: chalk.dim,
  bold: chalk.bold,
  italic: chalk.italic,

  // Labels
  label: chalk.white.bold,
  key: chalk.cyan,
  value: chalk.green,
  count: chalk.white.bold,
  file: chalk.dim,
  lang: chalk.magenta.bold,

  // Symbols
  tick: chalk.green('✓'),
  cross: chalk.red('✗'),
  warn_sym: chalk.yellow('⚠'),
  arrow: chalk.dim('→'),
  dot: chalk.dim('·'),
} as const;
