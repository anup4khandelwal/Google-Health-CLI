import { Command } from "commander";
import { readFileSync } from "node:fs";
import { HealthClient } from "../lib/healthapi/client.js";
import { print, printError, printSuccess, type OutputOptions } from "../lib/output.js";
import { isNotLoggedIn } from "../lib/auth.js";
import { isAPIError } from "../lib/healthapi/client.js";

function handleError(err: unknown, o: OutputOptions): never {
  if (isNotLoggedIn(err)) {
    printError({ status: "auth_error", message: (err as Error).message, hint: "Run: ghealth auth login" }, o);
  } else if (isAPIError(err)) {
    printError({ status: "api_error", message: (err as Error).message }, o);
  } else {
    printError({ status: "error", message: String(err) }, o);
  }
  process.exit(1);
}

export function makeSubscribersCommand(outOpts: () => OutputOptions): Command {
  const subs = new Command("subscribers").description("Manage webhook subscribers");

  subs
    .command("list")
    .description("List all subscribers for the configured project")
    .option("--page-size <n>", "Max results per page", "50")
    .option("--page-token <token>", "Pagination token")
    .action(async (opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.listSubscribers({
          pageSize: opts.pageSize ? parseInt(opts.pageSize as string, 10) : undefined,
          pageToken: opts.pageToken,
        });
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  subs
    .command("create")
    .description("Create a new subscriber")
    .requiredOption("--name <name>", "Subscriber name")
    .requiredOption("--topic <topic>", "Pub/Sub topic")
    .option("--event-types <types>", "Comma-separated event types")
    .action(async (opts) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        const result = await client.createSubscriber({
          name: opts.name as string,
          pubsubTopic: opts.topic as string,
          eventTypes: opts.eventTypes
            ? (opts.eventTypes as string).split(",").map((s: string) => s.trim())
            : undefined,
        });
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  subs
    .command("patch <id>")
    .description("Update a subscriber (reads JSON from stdin or --file)")
    .option("--file <path>", "JSON file to use as the request body")
    .option("--update-mask <mask>", "Comma-separated field mask")
    .action(async (id: string, opts) => {
      const o = outOpts();
      try {
        let body: Record<string, unknown>;
        if (opts.file) {
          body = JSON.parse(readFileSync(opts.file as string, "utf8")) as Record<string, unknown>;
        } else {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
        }
        const client = await HealthClient.create();
        const result = await client.patchSubscriber(id, body, opts.updateMask as string | undefined);
        print(result, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  subs
    .command("delete <id>")
    .description("Delete a subscriber by ID")
    .action(async (id: string) => {
      const o = outOpts();
      try {
        const client = await HealthClient.create();
        await client.deleteSubscriber(id);
        printSuccess(`Deleted subscriber: ${id}`, o);
      } catch (err) {
        handleError(err, o);
      }
    });

  return subs;
}
