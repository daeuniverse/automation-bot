import { Octokit } from "octokit";
// Create a personal access token at https://github.com/settings/tokens/new?scopes=repo
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// Compare: https://docs.github.com/en/rest/reference/users#get-the-authenticated-user
const main = async () => {
  try {
    const {
      data: { login },
    } = await octokit.rest.users.getAuthenticated();
    console.log("Hello, %s", login);

    // 1.1 get pull_request with a given commit
    // https://octokit.github.io/rest.js/v18#pulls-get
    const spliter =
      "<!--- Why is this change required? What problem does it solve? -->";

    const pr = await octokit.rest.pulls
      .get({
        owner: "daeuniverse",
        repo: "dae",
        pull_number: 225,
      })
      .then((res) => res.data);

    const context = `${pr.body?.split("### Checklist")[0].split(spliter)[1]}
      `.trim();

    // 1.2 update dae-wing sync pr description
    // https://octokit.github.io/rest.js/v18#pulls-update
    await octokit.rest.pulls
      .list({
        owner: "daeuniverse",
        repo: "dae-wing",
      })
      .then((res) => {
        const syncPR = res.data.filter((pr) =>
          pr.title.startsWith("chore(sync)")
        )[0];

        // construct new body
        const newBody = `
${syncPR.body}

### #${pr.number} - ${pr.title}

Ref: <${pr.html_url}>

Context:

${context}

---
`.trim();

        // 1.3 update PR description
        octokit.rest.pulls.update({
          owner: "daeuniverse",
          repo: "dae-wing",
          pull_number: syncPR.number,
          body: newBody,
        });
      });
  } catch (err: any) {
    console.log(err);
  }
};

main();
