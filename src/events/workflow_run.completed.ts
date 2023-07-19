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

// https://docs.github.com/en/webhooks-and-events/webhooks/webhook-events-and-payloads?actionType=completed#workflow_run
export = {
  name: "workflow_run.completed",
  config_key: "workflow_run.completed",
  handler: handler as Handler,
} as HandlerModule;

async function handler(
  context: Context<any>,
  app: Probot,
  repo: Repository,
  extension: Extension
): Promise<Result> {
  const syncSource = "dae";
  const syncTarget = "dae-wing";
  const syncWorkflowName = "Synchronize Upstream";
  const spliter =
    "<!--- Why is this change required? What problem does it solve? -->";

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

  // case_#1: sync upstream PR context to sync-upstream PR for syncTarget
  if (
    repo.name === syncTarget &&
    metadata.workflow_run.name == syncWorkflowName &&
    metadata.workflow_run.conclusion == "success"
  ) {
    await tracer.startActiveSpan(
      `app.handler.workflow_run.completed.${syncTarget}.update_pr_context`,
      {
        attributes: {
          case: `sync upstream PR context to sync-upstream PR for ${syncTarget}`,
          target: syncTarget,
          source: syncSource,
        },
      },
      async (span: Span) => {
        try {
          // 1.1 construct metadata from payload
          await tracer.startActiveSpan(
            `app.handler.workflow_run.completed.${syncTarget}.update_pr_context.metadata`,
            {
              attributes: {
                metadata: JSON.stringify(metadata),
              },
            },
            async (span: Span) => {
              span.end();
            }
          );

          // 1.2 get details for the latest merged pull_request
          const pr = await tracer.startActiveSpan(
            `app.handler.workflow_run.completed.${syncTarget}.update_pr_context.get_details`,
            {
              attributes: {
                functionality: "get details for the latest merged pull_request",
              },
            },
            async (span: Span) => {
              // https://octokit.github.io/rest.js/v18#pulls-list
              const result = await extension.octokit.rest.pulls
                .list({
                  repo: "dae",
                  owner: "daeuniverse",
                  state: "closed",
                  per_page: 1,
                })
                .then((res) => res.data[0]);

              span.end();
              span.addEvent(JSON.stringify(result));
              return result;
            }
          );

          // 1.2 update dae-wing sync pr description
          const syncPR = await tracer.startActiveSpan(
            `app.handler.workflow_run.completed.${syncTarget}.update_pr_context.update_pr_description`,
            {
              attributes: {
                functionality: "update dae-wing sync pr description",
                upstream_pr: JSON.stringify(pr),
              },
            },
            async (span: Span) => {
              const prContext = `${
                pr.body?.split("### Checklist")[0].split(spliter)[1]
              }
      `.trim();

              // https://octokit.github.io/rest.js/v18#pulls-update
              const result = await extension.octokit.rest.pulls
                .list({
                  owner: "daeuniverse",
                  repo: "dae-wing",
                })
                .then((res) => {
                  const syncPR = res.data.filter((pr) =>
                    pr.title.startsWith("chore(sync)")
                  )[0];

                  // construct new PR description body
                  const newBody = `
${syncPR.body}

### #${pr.number} - ${pr.title}

Ref: <${pr.html_url}>

Context:

${prContext}

---
`.trim();

                  // update PR description
                  extension.octokit.rest.pulls.update({
                    owner: "daeuniverse",
                    repo: "dae-wing",
                    pull_number: syncPR.number,
                    body: newBody,
                  });
                  return syncPR;
                });

              span.end();
              return result;
            }
          );

          // 1.3 audit event
          await tracer.startActiveSpan(
            `app.handler.workflow_run.completed.${syncTarget}.update_pr_context.audit_event`,
            { attributes: { functionality: "audit event" } },
            async (span: Span) => {
              const msg = `⚡️ context of sync-upstream PR [(#${syncPR.number})](${syncPR.html_url}) in ${syncTarget} has been updated; upstream PR from ${syncSource} - [#${pr.number}: ${pr.title}](${pr.html_url}))`;
              app.log.info(msg);
              await extension.tg.sendMsg(msg, [
                process.env.TELEGRAM_DAEUNIVERSE_AUDIT_CHANNEL_ID!,
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

  return { result: "ok!" };
}
