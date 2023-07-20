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

    // https://octokit.github.io/rest.js/v18#repos-list-commits
    const headCommitSha = await octokit.rest.repos
      .listCommits({
        repo: "dae",
        owner: "daeuniverse",
        per_page: 1,
      })
      .then((res) => res.data[0].sha);

    // https://octokit.github.io/rest.js/v18#pulls-list
    const pr = await octokit.rest.pulls
      .list({
        repo: "dae",
        owner: "daeuniverse",
        per_page: 50,
        state: "closed",
      })
      .then((res) =>
        res.data.filter((pr) => pr.merge_commit_sha === headCommitSha)
      );
    console.log(pr);
  } catch (err: any) {
    console.log(err);
  }
};

main();
