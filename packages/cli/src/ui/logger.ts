import { c } from './colors.js';

export interface LoggerOptions {
  verbose: boolean;
}

export interface CliLogger {
  debug(message: string): void;
  info(message: string): void;
  success(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  /** Print a blank line */
  spacer(): void;
  /** Print a section header */
  section(title: string): void;
  /** Print a key: value pair */
  kv(label: string, value: string): void;
}

export function createLogger(options: LoggerOptions): CliLogger {
  return {
    debug(message) {
      if (options.verbose) {
        process.stderr.write(`${c.dim('debug')} ${c.dim(message)}\n`);
      }
    },

    info(message) {
      process.stdout.write(`${c.info('info')}  ${message}\n`);
    },

    success(message) {
      process.stdout.write(`${c.tick} ${c.success(message)}\n`);
    },

    warn(message) {
      process.stderr.write(`${c.warn_sym} ${c.warn(message)}\n`);
    },

    error(message) {
      process.stderr.write(`${c.cross} ${c.error(message)}\n`);
    },

    spacer() {
      process.stdout.write('\n');
    },

    section(title) {
      process.stdout.write(`\n${c.brand('▸')} ${c.bold(title)}\n`);
    },

    kv(label, value) {
      const pad = 20;
      process.stdout.write(`  ${c.dim(label.padEnd(pad))} ${value}\n`);
    },
  };
}
