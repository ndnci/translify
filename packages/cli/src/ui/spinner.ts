import ora, { type Ora } from 'ora';
import { c } from './colors.js';

export interface SpinnerHandle {
  succeed(text?: string): void;
  fail(text?: string): void;
  update(text: string): void;
  stop(): void;
}

export function createSpinner(text: string): SpinnerHandle {
  const spinner: Ora = ora({
    text,
    color: 'blue',
    spinner: 'dots',
  }).start();

  return {
    succeed(text) {
      spinner.succeed(text ? c.success(text) : undefined);
    },
    fail(text) {
      spinner.fail(text ? c.error(text) : undefined);
    },
    update(text) {
      spinner.text = text;
    },
    stop() {
      spinner.stop();
    },
  };
}
