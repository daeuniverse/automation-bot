const defaultLables = [
  "fix",
  "feat",
  "feature",
  "patch",
  "ci",
  "optimize",
  "chore",
  "refactor",
  "style",
  "doc",
  "docs",
  "fixture",
];

const overwriteLabels = (input: string[]): string[] => {
  return input.map((item) => {
    if (item == "feat") item = "feature";
    if (item == "docs" || item == "doc") item = "documentation";
    return item;
  });
};

const testLabelRegex = (input: string): string[] => {
  // const re = /^(?<type>\w+)(\/\w+)*(\((?<scope>.+)\))?:/;
  const re = /^(?<type>\w+(\/\w+)*)(\((?<scope>.+)\))?:/;
  const { type } = input.match(re)?.groups!;
  const labels = type.split("/");

  return labels.length > 1
    ? overwriteLabels(
        labels.map(
          (label: string) => defaultLables.filter((x: string) => label === x)[0]
        )
      )
    : overwriteLabels(defaultLables.filter((x: string) => type === x));
};

const prTitle1 = "fixture(context): some title";
const prTitle2 = "fix(context): some title";
const prTitle3 = "docs(context): some title";
const prTitle4 = "docu(context): some title";
const prTitle5 = "feat: display daed version in header";
const prTitle6 = "feat/fix/ci(context): some title;";

console.log(testLabelRegex(prTitle1));
console.log(testLabelRegex(prTitle2));
console.log(testLabelRegex(prTitle3));
console.log(testLabelRegex(prTitle4));
console.log(testLabelRegex(prTitle5));
console.log(testLabelRegex(prTitle6));
