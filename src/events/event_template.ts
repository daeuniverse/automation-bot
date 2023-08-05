import { Span, SpanStatusCode } from "@opentelemetry/api";
import { Probot, Context } from "probot";
import {
  Handler,
  HandlerModule,
  Repository,
  Extension,
  Result,
} from "../common";
import { tracer } from "../trace";

export = {
  name: "check_run.completed",
  config_key: "check_run.completed",
  handler: handler as Handler,
} as HandlerModule;

async function handler(
  context: Context<any>,
  app: Probot,
  repo: Repository,
  extension: Extension
): Promise<Result> {
  const metadata = {
    repo: repo.name,
    owner: repo.owner,
    author: context.payload.sender.login,
    default_branch: context.payload.repository.default_branch,
    check_run: context.payload.check_run,
  };

  // instantiate span
  await tracer.startActiveSpan(
    "app.handler.star.created.event_logging",
    async (span: Span) => {
      const logs = `received a check_run.completed event: ${JSON.stringify(
        metadata
      )}`;
      app.log.info(logs);
      span.addEvent(logs);
      span.end();
    }
  );

  // case_#1: auto-merge sync-upstream pr in [dae-wing,daed]
  if (["daed-1"].includes(repo.name)) {
    await tracer.startActiveSpan(
      `app.handler.check_run.completed.${repo.name}.sync_upstream`,
      async (span: Span) => {
        try {
          // 1.1 construct metadata from payload
          await tracer.startActiveSpan(
            `app.handler.check_run.completed.${repo.name}.sync_upstream.metadata`,
            {
              attributes: {
                metadata: JSON.stringify(metadata),
              },
            },
            async (span: Span) => {
              span.end();
            }
          );

          // 1.x audit event
          await tracer.startActiveSpan(
            "app.handler.check_run.completed.${repo.name}.sync_upstream.audit_event",
            { attributes: { functionality: "audit event" } },
            async (span: Span) => {
              const msg = `hello`;
              app.log.info(msg);
              await extension.tg.sendMsg(msg, [
                process.env.TELEGRAM_DAEUNIVERSE_AUDIT_GROUP_ID!,
              ]);
              span.addEvent(msg);
              span.end();
            }
          );
        } catch (err: any) {
          app.log.error(err);
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR });
        }

        span.end();
      }
    );
  }

  // fallback
  return { result: "ok!" };
}
