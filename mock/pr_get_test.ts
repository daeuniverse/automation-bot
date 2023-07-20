import "dotenv/config";
import { Octokit } from "octokit";
const { createAppAuth } = require("@octokit/auth-app");
import fs from "fs";
var privateKey = fs.readFileSync("private-key-staging.pem", "utf8").toString();

// https://www.regexgo.com
const useRegex = (input: string): number | null => {
  let re = /([0-9]+)/;
  if (re.test(input)) {
    const result = input.match(re)!;
    return parseInt(result[0]);
  } else {
    return null;
  }
};

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
    const result = await octokit.rest.repos
      .listCommits({
        repo: "dae",
        owner: "daeuniverse",
        per_page: 1,
      })
      .then((res) => res.data[0].commit.message);
    const prNumber = useRegex(result);
    if (prNumber) {
      // https://octokit.github.io/rest.js/v18#pulls-get
      const result = await octokit.rest.pulls
        .get({
          repo: "dae",
          owner: "daeuniverse",
          pull_number: prNumber,
        })
        .then((res) => res.data);
      console.log(result);
    }
  } catch (err: any) {
    console.log(err);
  }
};

main();
