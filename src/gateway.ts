import { Repository } from "./common";
import { Context, Probot } from "probot";

type isDesiredEvent = boolean;

export class APIGateway {
  app: Probot;
  context: Context<any>;
  repo: Repository;
  event: string;
  metadata: Context<any>["payload"];

  constructor(app: Probot, context: Context<any>, event: string) {
    this.app = app;
    this.context = context;
    this.repo = {
      name: context.payload.repository.name,
      owner: context.payload.organization?.login as string,
    };
    this.event = event;
    this.metadata = context.payload;
  }

  async loadSubscriptions() {}

  // apply filters for a given event
  async acceptEvent(): Promise<isDesiredEvent> {
    var accepted: isDesiredEvent = true;

    switch (this.event) {
      case "check_run.completed":
        accepted =
          this.metadata.check_run.name.includes("dae-bot") &&
          this.metadata.check_run.conclusion === "success" &&
          this.metadata.check_run.pull_requests.length > 0;
        break;
      case "check_run.completed":
        accepted =
          ["dae-wing"].includes(this.repo.name) &&
          this.metadata.workflow_run.conclusion === "success";
        break;
      default:
        break;
    }

    !accepted && this.app.log.info("undesired event, dropped.");
    return accepted;
  }
}