import "dotenv/config";
import { Octokit } from "octokit";
const { createAppAuth } = require("@octokit/auth-app");
import fs from "fs";
var privateKey = fs.readFileSync("private-key-staging.pem", "utf8").toString();

// Compare: https://docs.github.com/en/rest/reference/users#get-the-authenticated-user
const main = async () => {
  try {
    // authenticate as GitHub App
    const auth = createAppAuth({
      appId: process.env.APP_ID,
      installationId: process.env.INSTALLATION_ID,
      privateKey,
    });
    const installationAuth = await auth({
      type: "installation",
    });
    const octokit = new Octokit({ auth: installationAuth.token });

    // create pull_request_review request
    // https://octokit.github.io/rest.js/v18#pulls-merge
    await octokit.rest.pulls.merge({
      repo: "daed-1",
      owner: "daeuniverse",
      pull_number: 18,
      merge_method: "squash",
    });
  } catch (err: any) {
    console.log(err);
  }
};

main();
