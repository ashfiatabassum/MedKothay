// PostToolUse hook: format app source files with Prettier after Claude edits them.
// Runs on Edit|Write. Only touches .js/.jsx/.mjs/.css under app/, components/, lib/,
// supabase/ or proxy.js. If Prettier is not installed yet (fresh clone), it falls back
// to normalizing trailing spaces and the final newline using Node built-ins only.
const fs = require("node:fs");
const path = require("node:path");

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", async () => {
  try {
    const event = JSON.parse(input);
    const filePath = event?.tool_input?.file_path;
    if (typeof filePath !== "string") return;

    const root = path.resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
    const absolute = path.resolve(root, filePath);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (relative.startsWith("../") || relative === ".." || path.isAbsolute(relative)) return;
    const inScope = /^(app|components|lib|supabase)\//.test(relative) || relative === "proxy.js";
    if (!inScope || !/\.(js|jsx|mjs|css)$/.test(relative)) return;
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return;

    const original = fs.readFileSync(absolute, "utf8");
    let formatted;
    let how;
    try {
      const prettier = require(require.resolve("prettier", { paths: [root] }));
      const options = (await prettier.resolveConfig(absolute)) || {};
      formatted = await prettier.format(original, { ...options, filepath: absolute });
      how = "Prettier";
    } catch (error) {
      if (error?.code !== "MODULE_NOT_FOUND") throw error;
      formatted = original
        .replace(/[ \t]+(?=\r?\n|$)/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n*$/, "\n");
      how = "whitespace (Prettier not installed)";
    }

    if (formatted !== original) {
      fs.writeFileSync(absolute, formatted, "utf8");
      process.stdout.write(`Formatted with ${how}: ${relative}\n`);
    }
  } catch (error) {
    process.stderr.write(`Format hook error: ${error.message}\n`);
    process.exitCode = 2;
  }
});
