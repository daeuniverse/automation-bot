import { Span, SpanStatusCode } from "@opentelemetry/api";
import { Probot, Context } from "probot";
import {
  Handler,
  HandlerModule,
  Repository,
  // Extension,
  Result,
} from "../common";
import { tracer } from "../trace";

// https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads?actionType=completed#workflow_run
export = {
  name: "workflow_run.completed",
  config_key: "workflow_run.completed",
  handler: handler as Handler,
} as HandlerModule;

async function handler(
  context: Context<"workflow_run.completed">,
  app: Probot,
  repo: Repository
  // extension: Extension
): Promise<Result> {
  const syncWorkflowName = "Synchronize Upstream";
  const syncTargets = ["dae-wing"];
  const metadata = {
    repo: repo.name,
    owner: repo.owner,
    author: context.payload.sender.login,
    default_branch: context.payload.repository.default_branch,
    workflow_run: {
      name: context.payload.workflow_run.name,
      head_branch: context.payload.workflow_run.head_branch,
      run_number: context.payload.workflow_run.run_number,
      event: context.payload.workflow_run.event,
      status: context.payload.workflow_run.status,
      conclusion: context.payload.workflow_run.conclusion,
      html_url: context.payload.workflow_run.html_url,
      updated_at: context.payload.workflow_run.updated_at,
      actor: context.payload.workflow_run.actor.login,
      job_url: context.payload.workflow_run.jobs_url,
    },
    workflow: {
      name: context.payload.workflow.name,
      path: context.payload.workflow.path,
    },
  };

  // instantiate span
  await tracer.startActiveSpan(
    "app.handler.workflow_run.completed.event_logging",
    async (span: Span) => {
      const logs = `received an workflow_run.completed event: ${JSON.stringify(
        metadata
      )}`;
      app.log.info(logs);
      span.addEvent(logs);
      span.end();
    }
  );

  // case_#1: sync upstream PR context to sync-upstream PR for syncTargets
  if (
    syncTargets.includes(metadata.repo) &&
    metadata.workflow_run.name == syncWorkflowName &&
    metadata.workflow_run.conclusion == "success"
  ) {
    await tracer.startActiveSpan(
      "app.handler.workflow_run.completed.update_pr_context",
      {
        attributes: {
          case: `sync upstream PR context to sync-upstream PR for ${metadata.repo}`,
        },
      },
      async (span: Span) => {
        try {
          // 1.1 construct metadata from payload
          await tracer.startActiveSpan(
            `app.handler.workflow_run.completed.update_pr_context.metadata`,
            {
              attributes: {
                metadata: JSON.stringify(metadata),
              },
            },
            async (span: Span) => {
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

  return { result: "ok!" };
}
