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

    // get ref object
    // https://octokit.github.io/rest.js/v18#git-get-ref
    const result = await octokit.rest.repos
      .get({
        owner: "daeuniverse",
        repo: "dae",
        ref: `refs/tags/v0.2.2rc1`,
      })
      .then((res) => res.data);
    console.log(result);
  } catch (err: any) {
    console.log(err);
  }
};

main();
