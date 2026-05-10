import { Command } from "commander";
import { REST_OPERATIONS } from "../lib/registry.js";
import { print, type OutputOptions } from "../lib/output.js";

export function makeEndpointsCommand(outOpts: () => OutputOptions): Command {
  return new Command("endpoints")
    .description("List available Google Health REST API endpoints")
    .option("--method <method>", "Filter by HTTP method (GET|POST|PATCH|DELETE)")
    .action((opts) => {
      const o = outOpts();
      let ops = REST_OPERATIONS;
      if (opts.method) {
        const filter = (opts.method as string).toUpperCase();
        ops = ops.filter((op) => op.method === filter);
      }
      print(ops, o);
    });
}
