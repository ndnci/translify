import { createCli } from './cli.js';

async function main(): Promise<void> {
  const program = createCli();

  // Handle unknown commands gracefully
  program.on('command:*', () => {
    process.stderr.write(
      `Unknown command: ${program.args.join(' ')}\nRun translify --help for usage.\n`,
    );
    process.exit(1);
  });

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`\nFatal: ${msg}\n`);
  process.exit(1);
});
