import { appendFileSync, readFileSync } from "node:fs";

type Rules = {
  fallbackTier: number;
  bumpAtLines: number;
  bumpAtFiles: number;
  tests: { match: string[]; except: string[]; sources?: SourceRule[] };
  tiers: Record<string, string[]>;
};

type SourceRule = { test: string; source: string[] };

type Change = { file: string; lines: number; oldName: boolean };

type MergeDanger = { door: string; blastRadius: string };

type Decision = {
  tier: number;
  baseTier: number;
  bumped: boolean;
  oneWay: boolean;
  files: number;
  lines: number;
  setBy: string[];
  dangerProblems: string[];
};

const TOP_TIER = 2;
const TIER_OF_CRITICAL_TEST = 1;

export function decide(changes: Change[], rules: Rules, body = ""): Decision {
  const tiers = changes.map((change) => ({
    file: change.file,
    tier: tierOfFile(change.file, rules),
  }));
  const baseTier =
    tiers.length === 0 ? rules.fallbackTier : Math.max(...tiers.map((item) => item.tier));
  const lines = changes.reduce((sum, change) => sum + change.lines, 0);
  const files = changes.filter((change) => !change.oldName).length;
  const large = lines >= rules.bumpAtLines || files >= rules.bumpAtFiles;
  const bumped = baseTier === 1 && large;
  const danger = readMergeDanger(body);
  const oneWay = /^one[- ]way\b/.test(danger.door);
  const tier = Math.max(bumped ? baseTier + 1 : baseTier, oneWay ? TOP_TIER : 0);
  const setBy = tiers
    .filter((item) => item.tier === baseTier)
    .map((item) => item.file)
    .slice(0, 10);
  return {
    tier,
    baseTier,
    bumped,
    oneWay,
    files,
    lines,
    setBy,
    dangerProblems: tier === TOP_TIER ? dangerProblems(danger) : [],
  };
}

function tierOfFile(file: string, rules: Rules): number {
  if (!isTest(file, rules)) {
    return tierOfCode(file, rules);
  }
  const testsCriticalCode = sourcesOf(file, rules).some(
    (source) => tierOfCode(source, rules) === TOP_TIER,
  );
  return testsCriticalCode ? TIER_OF_CRITICAL_TEST : 0;
}

function tierOfCode(file: string, rules: Rules): number {
  const tiers = Object.entries(rules.tiers)
    .filter(([, patterns]) => matchesAny(file, patterns))
    .map(([tier]) => Number(tier));
  return tiers.length > 0 ? Math.max(...tiers) : rules.fallbackTier;
}

function isTest(file: string, rules: Rules): boolean {
  return matchesAny(file, rules.tests.match) && !matchesAny(file, rules.tests.except);
}

const DEFAULT_SOURCES: SourceRule[] = [
  { test: "^(.*)\\.test\\.tsx?(\\.snap)?$", source: ["$1.ts", "$1.tsx"] },
];

function sourcesOf(testFile: string, rules: Rules): string[] {
  return (rules.tests.sources ?? DEFAULT_SOURCES).flatMap((rule) => {
    const pattern = new RegExp(rule.test);
    return pattern.test(testFile) ? rule.source.map((source) => testFile.replace(pattern, source)) : [];
  });
}

function matchesAny(file: string, patterns: string[]): boolean {
  return patterns.some((pattern) => new Bun.Glob(pattern).match(file));
}

function readMergeDanger(body: string): MergeDanger {
  const visible = visibleText(body);
  return {
    door: fieldValue(visible, "Door").toLowerCase(),
    blastRadius: fieldValue(visible, "Blast Radius"),
  };
}

function visibleText(body: string): string {
  const lines = body.split(/\r?\n/);
  const closesLater = closingMarksAfter(lines);
  const visible: string[] = [];
  let closingFence: RegExp | null = null;
  let inComment = false;
  lines.forEach((rawLine, index) => {
    let line = rawLine;
    if (inComment) {
      const end = line.indexOf("-->");
      if (end === -1) {
        return;
      }
      line = line.slice(end + 3);
      inComment = false;
    }
    if (closingFence) {
      if (closingFence.test(line)) {
        closingFence = null;
      }
      return;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (opening?.[1]) {
      const mark = opening[1];
      closingFence = new RegExp(`^ {0,3}${mark[0]}{${mark.length},}[ \\t]*$`);
      return;
    }
    const shown = withoutComments(line.replace(/`[^`]*`/g, ""), closesLater[index] ?? false);
    inComment = shown.opensComment;
    visible.push(shown.text);
  });
  return visible.join("\n");
}

function closingMarksAfter(lines: string[]): boolean[] {
  const after: boolean[] = Array.from({ length: lines.length }, () => false);
  for (let index = lines.length - 2; index >= 0; index--) {
    after[index] = (after[index + 1] ?? false) || (lines[index + 1] ?? "").includes("-->");
  }
  return after;
}

function withoutComments(
  line: string,
  closesLater: boolean,
): { text: string; opensComment: boolean } {
  let text = line;
  while (true) {
    const start = text.indexOf("<!--");
    if (start === -1) {
      return { text, opensComment: false };
    }
    const end = text.indexOf("-->", start + 2);
    if (end !== -1) {
      text = text.slice(0, start) + text.slice(end + 3);
      continue;
    }
    const startsLine = /^ {0,3}$/.test(text.slice(0, start));
    return startsLine || closesLater
      ? { text: text.slice(0, start), opensComment: true }
      : { text, opensComment: false };
  }
}

function fieldValue(body: string, name: string): string {
  const match = body.match(
    new RegExp(`^[ \\t]*(?:>[ \\t]*)?\\*\\*${name}(?::\\*\\*|\\*\\*:)[ \\t]*(.*)$`, "m"),
  );
  const value = match?.[1]?.trim() ?? "";
  return /^<.*>$/.test(value) ? "" : value;
}

function dangerProblems(danger: MergeDanger): string[] {
  const problems: string[] = [];
  if (!/^(one|two)[- ]way\b/.test(danger.door)) {
    problems.push("Write `**Door:** one-way` or `**Door:** two-way` under Merge Danger.");
  }
  if (danger.blastRadius === "") {
    problems.push("Fill in `**Blast Radius:**` under Merge Danger.");
  }
  return problems;
}

function readChanges(input: string): Change[] {
  return input
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [file = "", lines = "0", kind = ""] = line.split("\t");
      const count = Number(lines);
      return { file, lines: Number.isFinite(count) ? count : 0, oldName: kind === "old" };
    });
}

function reasons(decision: Decision): string[] {
  const list = ["The files below set the base tier."];
  if (decision.bumped) {
    list.push(
      `The change is large (${decision.lines} lines, ${decision.files} files). The tier went up from ${decision.baseTier}.`,
    );
  }
  if (decision.oneWay) {
    list.push("The pull request declares a one-way door, so it is tier 2.");
  }
  return list;
}

function describe(decision: Decision): string {
  return [
    `### Risk tier ${decision.tier}`,
    "",
    ...reasons(decision),
    "",
    ...decision.setBy.map((file) => `- \`${file}\``),
    ...(decision.dangerProblems.length > 0
      ? [
          "",
          "#### Merge Danger is not complete",
          "",
          ...decision.dangerProblems.map((problem) => `- ${problem}`),
        ]
      : []),
  ].join("\n");
}

function main() {
  const [rulesPath = ".github/risk-tiers.json"] = process.argv.slice(2);
  const rules: Rules = JSON.parse(readFileSync(rulesPath, "utf8"));
  const decision = decide(readChanges(readFileSync(0, "utf8")), rules, process.env.PR_BODY ?? "");
  console.log(describe(decision));
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    const complete = decision.dangerProblems.length === 0;
    appendFileSync(outputPath, `tier=${decision.tier}\nmerge-danger-complete=${complete}\n`);
  }
}

if (import.meta.main) {
  main();
}
