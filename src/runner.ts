/**
 * Runner module - executes branch-narrator CLI via npx.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as core from "@actions/core";
import type { FactsOutput, RiskReport, RunResult } from "./types.js";

const execAsync = promisify(exec);

export interface RunnerOptions {
  version: string;
  baseSha: string;
  headSha: string;
  profile: string;
  redact: boolean;
}

/**
 * Execute a shell command and return stdout.
 */
async function runCommand(command: string): Promise<string> {
  core.debug(`Executing: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      env: {
        ...process.env,
        // Ensure npm/npx uses the correct registry for scoped packages
        npm_config_registry: "https://registry.npmjs.org",
      },
    });

    if (stderr) {
      core.debug(`stderr: ${stderr}`);
    }

    return stdout;
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    core.error(`Command failed: ${execError.message}`);
    if (execError.stderr) {
      core.error(`stderr: ${execError.stderr}`);
    }
    throw error;
  }
}

/**
 * Run branch-narrator facts command.
 */
async function runFacts(options: RunnerOptions): Promise<FactsOutput> {
  const { version, baseSha, headSha, profile, redact } = options;

  const args = [
    `npx -y @better-vibe/branch-narrator@${version}`,
    "facts",
    "--mode branch",
    `--base ${baseSha}`,
    `--head ${headSha}`,
    `--profile ${profile}`,
    "--no-timestamp",
  ];

  if (redact) {
    args.push("--redact");
  }

  const command = args.join(" ");
  core.info(`Running: branch-narrator facts`);

  const output = await runCommand(command);

  try {
    return JSON.parse(output) as FactsOutput;
  } catch {
    core.error(`Failed to parse facts output as JSON`);
    core.debug(`Raw output: ${output.substring(0, 1000)}...`);
    throw new Error("Failed to parse facts output as JSON");
  }
}

/**
 * Run branch-narrator risk-report command.
 */
async function runRiskReport(options: RunnerOptions): Promise<RiskReport> {
  const { version, baseSha, headSha, redact } = options;
  // Note: risk-report uses profile detection internally via changeSet
  // We don't pass --profile here as it's not a supported flag for risk-report

  const args = [
    `npx -y @better-vibe/branch-narrator@${version}`,
    "risk-report",
    "--mode branch",
    `--base ${baseSha}`,
    `--head ${headSha}`,
    "--format json",
    "--no-timestamp",
  ];

  if (redact) {
    args.push("--redact");
  }

  const command = args.join(" ");
  core.info("Running: branch-narrator risk-report");

  const output = await runCommand(command);

  try {
    return JSON.parse(output) as RiskReport;
  } catch {
    core.error("Failed to parse risk-report output as JSON");
    core.debug(`Raw output: ${output.substring(0, 1000)}...`);
    throw new Error("Failed to parse risk-report output as JSON");
  }
}

/**
 * Run both branch-narrator commands and return results.
 */
export async function runBranchNarrator(options: RunnerOptions): Promise<RunResult> {
  core.startGroup("Running branch-narrator analysis");

  try {
    // Run both commands in parallel for efficiency
    const [facts, riskReport] = await Promise.all([
      runFacts(options),
      runRiskReport(options),
    ]);

    core.info(`Analysis complete: risk score ${riskReport.riskScore}, ${riskReport.flags.length} flags`);
    core.endGroup();

    return { facts, riskReport };
  } catch (error) {
    core.endGroup();
    throw error;
  }
}
