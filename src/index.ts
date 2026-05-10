import { Command } from "commander";
import { type OutputOptions, type OutputFormat } from "./lib/output.js";
import { makeAuthCommand } from "./commands/auth.js";
import { makeConfigCommand } from "./commands/config.js";
import { makeDataCommand } from "./commands/data.js";
import { makeRollupCommand } from "./commands/rollup.js";
import { makeProfileCommand } from "./commands/profile.js";
import { makeSettingsCommand } from "./commands/settings.js";
import { makeIdentityCommand } from "./commands/identity.js";
import { makeSubscribersCommand } from "./commands/subscribers.js";
import { makeTypesCommand } from "./commands/types.js";
import { makeEndpointsCommand } from "./commands/endpoints.js";
import { makeDoctorCommand } from "./commands/doctor.js";
import { makeAgentCommand } from "./commands/agent.js";
import { makeAPICommand } from "./commands/api.js";

const VERSION = "1.0.0";

const program = new Command();

// Shared output options state
const sharedOpts: OutputOptions = {};

function getOutputOpts(): OutputOptions {
  return { ...sharedOpts };
}

program
  .name("ghealth")
  .description("Unofficial CLI for the Google Health API v4")
  .version(VERSION, "-v, --version", "Print version number")
  .option("--json", "Force JSON output format")
  .option("--pretty", "Pretty-print JSON output")
  .option("--format <fmt>", "Output format: auto|table|json|ndjson|csv|markdown")
  .option("--base-url <url>", "Override the API base URL")
  .option("--user <user>", "Override the user resource (default: me)")
  .option("--project <project>", "Override the project ID")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts<{
      json?: boolean;
      pretty?: boolean;
      format?: OutputFormat;
      baseUrl?: string;
      user?: string;
      project?: string;
    }>();

    if (opts.json) sharedOpts.format = "json";
    else if (opts.format) sharedOpts.format = opts.format as OutputFormat;
    if (opts.pretty) sharedOpts.pretty = true;

    // Apply environment overrides for base URL, user, project
    if (opts.baseUrl) process.env["GHEALTH_BASE_URL"] = opts.baseUrl;
    if (opts.user) process.env["GHEALTH_USER"] = opts.user;
    if (opts.project) process.env["GHEALTH_PROJECT"] = opts.project;
  });

program.addCommand(makeAuthCommand(getOutputOpts));
program.addCommand(makeConfigCommand(getOutputOpts));
program.addCommand(makeDataCommand(getOutputOpts));
program.addCommand(makeRollupCommand(getOutputOpts));
program.addCommand(makeProfileCommand(getOutputOpts));
program.addCommand(makeSettingsCommand(getOutputOpts));
program.addCommand(makeIdentityCommand(getOutputOpts));
program.addCommand(makeSubscribersCommand(getOutputOpts));
program.addCommand(makeTypesCommand(getOutputOpts));
program.addCommand(makeEndpointsCommand(getOutputOpts));
program.addCommand(makeDoctorCommand(getOutputOpts));
program.addCommand(makeAgentCommand(getOutputOpts));
program.addCommand(makeAPICommand(getOutputOpts));

program.parseAsync(process.argv).catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
