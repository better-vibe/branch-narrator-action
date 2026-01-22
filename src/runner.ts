/**
 * Runner module - executes branch-narrator CLI via npx.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as core from "@actions/core";
import type {
  FactsOutputWithDelta,
  RiskReportWithDelta,
  RunResult,
} from "./types.js";

const execAsync = promisify(exec);

/**
 * Resolve the actual version of branch-narrator from npm registry.
 * If the requested version is a tag (like "latest"), this returns the actual semver.
 */
async function resolveVersion(requestedVersion: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `npm view @better-vibe/branch-narrator@${requestedVersion} version`,
      { timeout: 15000 }
    );
    return stdout.trim();
  } catch (error) {
    core.debug(`Failed to resolve version, using requested: ${error}`);
    return requestedVersion;
  }
}

export interface RunnerOptions {
  version: string;
  baseSha: string;
  headSha: string;
  profile: string;
  redact: boolean;
  // SARIF options
  sarifUpload: boolean;
  sarifFile: string;
  // Delta mode options
  baselinePath?: string;
  sinceStrict: boolean;
  // File filtering
  exclude: string[];
  include: string[];
  // Category filtering (for risk-report)
  riskOnlyCategories: string[];
  riskExcludeCategories: string[];
  // Size limits
  maxFileBytes?: number;
  maxDiffBytes?: number;
  maxFindings?: number;
  // Score explanation
  explainScore: boolean;
  // Evidence control
  maxEvidenceLines: number;
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
async function runFacts(options: RunnerOptions): Promise<FactsOutputWithDelta> {
  const {
    version,
    baseSha,
    headSha,
    profile,
    redact,
    baselinePath,
    sinceStrict,
    exclude,
    include,
    maxFileBytes,
    maxDiffBytes,
    maxFindings,
  } = options;

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

  // Delta mode
  if (baselinePath) {
    args.push(`--since "${baselinePath}"`);
    if (sinceStrict) {
      args.push("--since-strict");
    }
  }

  // File filtering
  for (const pattern of exclude) {
    args.push(`--exclude "${pattern}"`);
  }
  for (const pattern of include) {
    args.push(`--include "${pattern}"`);
  }

  // Size limits
  if (maxFileBytes !== undefined) {
    args.push(`--max-file-bytes ${maxFileBytes}`);
  }
  if (maxDiffBytes !== undefined) {
    args.push(`--max-diff-bytes ${maxDiffBytes}`);
  }
  if (maxFindings !== undefined) {
    args.push(`--max-findings ${maxFindings}`);
  }

  const command = args.join(" ");
  core.info(`Running: branch-narrator facts`);

  const output = await runCommand(command);

  try {
    return JSON.parse(output) as FactsOutputWithDelta;
  } catch {
    core.error(`Failed to parse facts output as JSON`);
    core.debug(`Raw output: ${output.substring(0, 1000)}...`);
    throw new Error("Failed to parse facts output as JSON");
  }
}

/**
 * Run branch-narrator risk-report command.
 */
async function runRiskReport(options: RunnerOptions): Promise<RiskReportWithDelta> {
  const {
    version,
    baseSha,
    headSha,
    redact,
    baselinePath,
    sinceStrict,
    riskOnlyCategories,
    riskExcludeCategories,
    explainScore,
    maxEvidenceLines,
  } = options;
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

  // Delta mode
  if (baselinePath) {
    // Use separate baseline for risk-report
    const riskBaselinePath = baselinePath.replace("facts.json", "risk-report.json");
    args.push(`--since "${riskBaselinePath}"`);
    if (sinceStrict) {
      args.push("--since-strict");
    }
  }

  // Category filtering
  if (riskOnlyCategories.length > 0) {
    args.push(`--only ${riskOnlyCategories.join(",")}`);
  }
  if (riskExcludeCategories.length > 0) {
    args.push(`--exclude ${riskExcludeCategories.join(",")}`);
  }

  // Score explanation
  if (explainScore) {
    args.push("--explain-score");
  }

  // Evidence control
  if (maxEvidenceLines !== undefined) {
    args.push(`--max-evidence-lines ${maxEvidenceLines}`);
  }

  const command = args.join(" ");
  core.info("Running: branch-narrator risk-report");

  const output = await runCommand(command);

  try {
    return JSON.parse(output) as RiskReportWithDelta;
  } catch {
    core.error("Failed to parse risk-report output as JSON");
    core.debug(`Raw output: ${output.substring(0, 1000)}...`);
    throw new Error("Failed to parse risk-report output as JSON");
  }
}

/**
 * Run branch-narrator facts command with SARIF output.
 */
async function runFactsSarif(options: RunnerOptions): Promise<string> {
  const {
    version,
    baseSha,
    headSha,
    profile,
    redact,
    sarifFile,
    exclude,
    include,
    maxFileBytes,
    maxDiffBytes,
    maxFindings,
  } = options;

  const args = [
    `npx -y @better-vibe/branch-narrator@${version}`,
    "facts",
    "--mode branch",
    `--base ${baseSha}`,
    `--head ${headSha}`,
    `--profile ${profile}`,
    "--format sarif",
    `--out "${sarifFile}"`,
    "--no-timestamp",
  ];

  if (redact) {
    args.push("--redact");
  }

  // File filtering
  for (const pattern of exclude) {
    args.push(`--exclude "${pattern}"`);
  }
  for (const pattern of include) {
    args.push(`--include "${pattern}"`);
  }

  // Size limits
  if (maxFileBytes !== undefined) {
    args.push(`--max-file-bytes ${maxFileBytes}`);
  }
  if (maxDiffBytes !== undefined) {
    args.push(`--max-diff-bytes ${maxDiffBytes}`);
  }
  if (maxFindings !== undefined) {
    args.push(`--max-findings ${maxFindings}`);
  }

  const command = args.join(" ");
  core.info(`Running: branch-narrator facts --format sarif`);

  await runCommand(command);

  return sarifFile;
}

/**
 * Run branch-narrator pr-body command for human-readable markdown output.
 */
async function runPrBody(options: RunnerOptions): Promise<string> {
  const {
    version,
    baseSha,
    headSha,
    profile,
    exclude,
    include,
    maxFileBytes,
    maxDiffBytes,
    maxFindings,
  } = options;

  const args = [
    `npx -y @better-vibe/branch-narrator@${version}`,
    "pr-body",
    "--mode branch",
    `--base ${baseSha}`,
    `--head ${headSha}`,
    `--profile ${profile}`,
  ];

  // File filtering
  for (const pattern of exclude) {
    args.push(`--exclude "${pattern}"`);
  }
  for (const pattern of include) {
    args.push(`--include "${pattern}"`);
  }

  // Size limits
  if (maxFileBytes !== undefined) {
    args.push(`--max-file-bytes ${maxFileBytes}`);
  }
  if (maxDiffBytes !== undefined) {
    args.push(`--max-diff-bytes ${maxDiffBytes}`);
  }
  if (maxFindings !== undefined) {
    args.push(`--max-findings ${maxFindings}`);
  }

  const command = args.join(" ");
  core.info("Running: branch-narrator pr-body");

  return await runCommand(command);
}

/**
 * Run all branch-narrator commands and return results.
 */
export async function runBranchNarrator(options: RunnerOptions): Promise<RunResult> {
  core.startGroup("Running branch-narrator analysis");

  try {
    // Resolve actual version first
    core.info(`Resolving branch-narrator version: ${options.version}`);
    const resolvedVersion = await resolveVersion(options.version);

    if (resolvedVersion !== options.version) {
      core.info(`Resolved version: ${options.version} -> ${resolvedVersion}`);
    } else {
      core.info(`Using version: ${resolvedVersion}`);
    }

    // Build list of commands to run in parallel
    // facts, risk-report, and pr-body always run
    // SARIF is optional
    const promises: Promise<unknown>[] = [
      runFacts(options),
      runRiskReport(options),
      runPrBody(options),
    ];

    // Optionally run SARIF generation
    if (options.sarifUpload) {
      promises.push(runFactsSarif(options));
    }

    const results = await Promise.all(promises);

    const facts = results[0] as Awaited<ReturnType<typeof runFacts>>;
    const riskReport = results[1] as Awaited<ReturnType<typeof runRiskReport>>;
    const prBodyMarkdown = results[2] as string;
    const sarifPath = options.sarifUpload ? (results[3] as string) : undefined;

    core.info(`Analysis complete: risk score ${riskReport.riskScore}, ${riskReport.flags.length} flags`);
    core.endGroup();

    return { facts, riskReport, prBodyMarkdown, sarifPath, resolvedVersion };
  } catch (error) {
    core.endGroup();
    throw error;
  }
}
