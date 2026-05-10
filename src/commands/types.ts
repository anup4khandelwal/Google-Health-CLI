import { Command } from "commander";
import { getTypes, lookupType } from "../lib/registry.js";
import { print, printError, type OutputOptions } from "../lib/output.js";

export function makeTypesCommand(outOpts: () => OutputOptions): Command {
  const types = new Command("types").description("Inspect supported Google Health data types");

  types
    .command("list")
    .description("List all supported data types")
    .option("--record-type <type>", "Filter by record type (Interval|Sample|Session|Daily)")
    .action((opts) => {
      const o = outOpts();
      let all = getTypes();
      if (opts.recordType) {
        const filter = (opts.recordType as string).toLowerCase();
        all = all.filter((t) => t.recordType.toLowerCase() === filter);
      }
      print(all, o);
    });

  types
    .command("get <type>")
    .description("Show details for a specific data type")
    .action((type: string) => {
      const o = outOpts();
      const dt = lookupType(type);
      if (!dt) {
        printError({ status: "error", message: `Unknown data type: ${type}`, hint: "Run: ghealth types list" }, o);
        process.exit(1);
      }
      print(dt, o);
    });

  return types;
}
