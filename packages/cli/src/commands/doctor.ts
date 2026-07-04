import type { Command } from 'commander';
import { resolveConfigPath, resolveConfig } from '@ndnci/translify-config';
import { scanTranslationFiles } from '@ndnci/translify-core';
import type { CliLogger } from '../ui/logger.js';
import { c } from '../ui/colors.js';

export function registerDoctorCommand(program: Command, logger: CliLogger): void {
  program
    .command('doctor')
    .description('Check your Translify setup and environment for common problems')
    .addHelpText(
      'after',
      `
${c.dim('Examples:')}
  ${c.brand('$')} translify doctor
`,
    )
    .action(async () => {
      const { cwd, config: configPath } = program.opts<{
        cwd: string;
        config?: string;
      }>();

      logger.spacer();
      process.stdout.write(`${c.brand('▸')} ${c.bold('Translify Doctor')}\n\n`);

      const checks: Array<{ label: string; pass: boolean; detail?: string | undefined }> = [];

      // ── Node.js version ──────────────────────────────────────────────────
      const nodeVersion = process.versions.node;
      const [major] = nodeVersion.split('.').map(Number);
      checks.push({
        label: `Node.js ${nodeVersion}`,
        pass: (major ?? 0) >= 22,
        detail: (major ?? 0) < 22 ? 'Translify requires Node.js 22+' : undefined,
      });

      // ── Config file ──────────────────────────────────────────────────────
      let configFound = false;
      let translationFilesOk = false;

      try {
        const resolved = resolveConfigPath(cwd, configPath);
        configFound = true;
        checks.push({
          label: `Config found: ${resolved.path.replace(cwd + '/', '')}`,
          pass: true,
        });

        // Load and validate config
        const { config } = await resolveConfig({ cwd, ...(configPath && { configPath }) });

        // ── Translation files ────────────────────────────────────────────
        const translationPaths = await scanTranslationFiles(config, cwd);
        translationFilesOk = translationPaths.length > 0;
        checks.push({
          label: `Translation files (${translationPaths.length} found)`,
          pass: translationFilesOk,
          detail: !translationFilesOk
            ? `No files matched: ${config.translations.files.join(', ')}`
            : undefined,
        });

        // ── AI config (if enabled) ───────────────────────────────────────
        if (config.ai_translation.enabled) {
          const hasKey = !!config.ai_translation.openai_api_key;
          checks.push({
            label: `AI provider: ${config.ai_translation.provider}`,
            pass: hasKey,
            detail: !hasKey
              ? 'API key missing — set openai_api_key or OPENAI_API_KEY env var'
              : undefined,
          });
        }
      } catch (err) {
        if (!configFound) {
          checks.push({
            label: 'Config file',
            pass: false,
            detail: 'Not found. Run `translify init` to create one.',
          });
        } else {
          checks.push({
            label: 'Config validation',
            pass: false,
            detail: (err as Error).message,
          });
        }
      }

      // ── Print results ────────────────────────────────────────────────────
      let allPassed = true;
      for (const check of checks) {
        const icon = check.pass ? c.tick : c.cross;
        process.stdout.write(`  ${icon} ${check.label}\n`);
        if (check.detail) {
          process.stdout.write(`    ${c.dim(check.detail)}\n`);
        }
        if (!check.pass) allPassed = false;
      }

      logger.spacer();
      if (allPassed) {
        logger.success('Everything looks good!');
      } else {
        logger.warn('Some checks failed. Review the output above.');
        process.exit(1);
      }
      logger.spacer();
    });
}
