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
  const syncBranch = "sync-upstream";
  // set syncSource [dae|dae-wing] based on the source commit [dae-wing|daed], respectively
  const syncSource =
    context.payload.repository.name == "dae-wing" ? "dae" : "dae-wing";
  // set syncTarget [dae-wing|daed] based on the source commit [dae|dae-wing], respectively
  const syncTarget =
    context.payload.repository.name == "dae" ? "dae-wing" : "daed";
  const metadata = {
    repo: repo.name,
    owner: repo.owner,
    author: context.payload.sender.login,
    default_branch: context.payload.repository.default_branch,
    check_run: {
      name: context.payload.check_run.name,
      head_sha: context.payload.check_run.head_sha,
      html_url: context.payload.check_run.html_url,
      status: context.payload.check_run.status,
      conclusion: context.payload.check_run.conclusion,
      started_at: context.payload.check_run.started_at,
      completed_at: context.payload.check_run.completed_at,
    },
    pull_request:
      context.payload.check_run.pull_request.length > 0
        ? {
            number: context.payload.check_run.pull_requests[0].number,
            head: {
              ref: context.payload.check_run.pull_requests[0].head.ref,
              sha: context.payload.check_run.pull_requests[0].head.sha,
            },
            base: {
              ref: context.payload.check_run.pull_requests[0].base.ref,
              sha: context.payload.check_run.pull_requests[0].base.sha,
            },
          }
        : null,
  };

  // instantiate span
  if (
    metadata.check_run.name.includes("dae-bot") &&
    metadata.check_run.conclusion == "success" &&
    metadata.pull_request
  ) {
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
  }

  // case_#1: auto-merge sync-upstream pr in [dae-wing,daed]
  if (
    ["daed"].includes(repo.name) &&
    metadata.check_run.name.includes("build-passed") &&
    !metadata.check_run.name.includes("instantiate") &&
    metadata.check_run.status == "completed" &&
    metadata.pull_request &&
    // metadata.pull_request.head.ref == syncBranch &&
    metadata.check_run.conclusion == "success"
  )
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
                syncBranch,
                syncSource,
                syncTarget,
              },
            },
            async (span: Span) => {
              span.end();
            }
          );

          // 1.2 write pre-auto-merge comment in the associated PR
          await tracer.startActiveSpan(
            `app.handler.check_run.completed.${repo.name}.sync_upstream.write_pr_comment`,
            {
              attributes: {
                functionality:
                  "write pre-auto-merge comment in the associated PR",
                pr_number: metadata.pull_request?.number,
                pr_head_sha: metadata.pull_request?.head.sha,
                pr_head_ref: metadata.pull_request?.head.ref,
              },
            },
            async (span: Span) => {
              //https://octokit.github.io/rest.js/v18#issues-create-comment
              await extension.octokit.issues.createComment({
                owner: repo.owner,
                repo: repo.name,
                issue_number: metadata.pull_request?.number,
                body: `⚡ Build passed, automatically closed and merged. Check run details: ${metadata.check_run.html_url}`,
              });

              span.end();
            }
          );

          // 1.3 get the associated pr details
          const pr = await tracer.startActiveSpan(
            `app.handler.check_run.completed.${repo.name}.sync_upstream.get_pr_details`,
            {
              attributes: {
                functionality: "get the associated pr details",
              },
            },
            async (span: Span) => {
              const result = await extension.octokit.pulls
                .get({
                  owner: repo.owner,
                  repo: repo.name,
                  pull_number: metadata.pull_request?.number,
                })
                .then((res) => res.data);

              span.addEvent(JSON.stringify(result));
              span.end();
              return result;
            }
          );

          // 1.4 automatically merge pull_request if all required checks pass
          await tracer.startActiveSpan(
            `app.handler.check_run.completed.${repo.name}.sync_upstream.auto_merge_pr`,
            {
              attributes: { functionality: "automatically merge pull_request" },
            },
            async (span: Span) => {
              // https://octokit.github.io/rest.js/v18#pulls-merge
              await extension.octokit.pulls.merge({
                repo: metadata.repo,
                owner: metadata.owner,
                pull_number: pr.number,
                merge_method: "squash",
              });
              const msg = "🛫 All good, merged to main.";
              app.log.info(msg);
              span.addEvent(msg);
              span.end();
            }
          );

          // 1.5 audit event
          await tracer.startActiveSpan(
            `app.handler.check_run.completed.${repo.name}.sync_upstream.audit_event`,
            { attributes: { functionality: "audit event" } },
            async (span: Span) => {
              const msg = `🛫 The workflow run associated with PR - [#${pr.number}: ${pr.title}](${pr.html_url}) has passed all the required checks; automatically closed and merged. Check-run details: ${metadata.check_run.html_url}`;
              app.log.info(msg);
              await extension.tg.sendMsg(msg, [
                process.env.TELEGRAM_DAEUNIVERSE_AUDIT_CHANNEL_ID!,
              ]);

              span.addEvent(msg);
              span.end();
            }
          );

          span.end();
        } catch (err: any) {
          app.log.error(err);
          span.recordException(err);
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
      }
    );

  // fallback
  return { result: "ok!" };
}
