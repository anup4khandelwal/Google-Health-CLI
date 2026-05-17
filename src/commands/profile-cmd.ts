import { Command } from "commander";
import { getActiveProfile, listProfiles, getConfigPath } from "../lib/config.js";
import { currentStatus } from "../lib/auth.js";
import { print, type OutputOptions } from "../lib/output.js";

export function makeProfileCmdCommand(outOpts: () => OutputOptions): Command {
  const cmd = new Command("profile-cmd")
    .name("profiles")
    .description("Manage named configuration profiles");

  cmd
    .command("list")
    .description("List all available profiles")
    .action(() => {
      const o = outOpts();
      const active = getActiveProfile();
      const all = listProfiles();
      print(all.map((p) => ({ profile: p, active: p === active })), o);
    });

  cmd
    .command("current")
    .description("Show the active profile name and its status")
    .action(() => {
      const o = outOpts();
      const active = getActiveProfile();
      const auth = currentStatus();
      print(
        {
          profile: active,
          configPath: getConfigPath(),
          loggedIn: auth.loggedIn,
          expiresAt: auth.expiresAt?.toISOString() ?? null,
        },
        o,
      );
    });

  return cmd;
}
