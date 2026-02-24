// Scout GitHub integration - CLI-based via `gh` command
// Scout-unique: uses execSync with gh CLI rather than REST API

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DOCS_PATH = '/opt/mattermost/playbook-templates/docs';
const REPO_PATH = '/opt/mattermost/playbook-templates';

// Execute a gh CLI command
export function getGitHubData(command, ctx) {
  const { log } = ctx;
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: 30000,
      cwd: '/opt/mattermost/playbook-templates'
    });
    return result.trim();
  } catch (error) {
    log('error', 'GitHub command failed', { command, error: error.message });
    return null;
  }
}

export function getRecentCommits(repo, count = 5, ctx) {
  const cmd = `gh api repos/${repo}/commits --jq '.[0:${count}] | .[] | "- \\(.commit.message | split("\\n")[0]) by \\(.commit.author.name) (\\(.sha[0:7]))"'`;
  return getGitHubData(cmd, ctx);
}

export function getOpenPRs(repo, ctx) {
  const cmd = `gh pr list --repo ${repo} --limit 10 --json number,title,author,createdAt --jq '.[] | "- #\\(.number): \\(.title) by @\\(.author.login)"'`;
  return getGitHubData(cmd, ctx);
}

export function getOpenIssues(repo, ctx) {
  const cmd = `gh issue list --repo ${repo} --limit 10 --json number,title,author,createdAt --jq '.[] | "- #\\(.number): \\(.title)"'`;
  return getGitHubData(cmd, ctx);
}

export function createGitHubIssue(repo, title, body, ctx) {
  const cmd = `gh issue create --repo ${repo} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`;
  return getGitHubData(cmd, ctx);
}

export function createGitHubBranch(repo, branchName, ctx) {
  const cmd = `gh api repos/${repo}/git/refs -f ref="refs/heads/${branchName}" -f sha="$(gh api repos/${repo}/git/refs/heads/main --jq '.object.sha' 2>/dev/null || gh api repos/${repo}/git/refs/heads/master --jq '.object.sha')"`;
  return getGitHubData(cmd, ctx);
}

export function createGitHubPR(repo, title, body, headBranch, baseBranch = 'main', ctx) {
  const safeTitle = title.replace(/"/g, '\\"');
  const safeBody = body.replace(/"/g, '\\"');
  const cmd = `gh pr create --repo ${repo} --title "${safeTitle}" --body "${safeBody}" --head "${headBranch}" --base "${baseBranch}"`;
  return getGitHubData(cmd, ctx);
}

export function commentOnGitHubIssue(repo, issueNumber, comment, ctx) {
  const safeComment = comment.replace(/"/g, '\\"');
  const cmd = `gh issue comment ${issueNumber} --repo ${repo} --body "${safeComment}"`;
  return getGitHubData(cmd, ctx);
}

export function commentOnGitHubPR(repo, prNumber, comment, ctx) {
  const safeComment = comment.replace(/"/g, '\\"');
  const cmd = `gh pr comment ${prNumber} --repo ${repo} --body "${safeComment}"`;
  return getGitHubData(cmd, ctx);
}

export async function updateGitHubFile(repo, filePath, content, commitMessage, branch = 'main', ctx) {
  const safeMessage = commitMessage.replace(/"/g, '\\"');
  const base64Content = Buffer.from(content).toString('base64');
  const getShaCmd = `gh api repos/${repo}/contents/${filePath}?ref=${branch} --jq '.sha' 2>/dev/null || echo ""`;
  const sha = getGitHubData(getShaCmd, ctx);

  let cmd;
  if (sha && sha.trim()) {
    cmd = `gh api repos/${repo}/contents/${filePath} -X PUT -f message="${safeMessage}" -f content="${base64Content}" -f branch="${branch}" -f sha="${sha.trim()}"`;
  } else {
    cmd = `gh api repos/${repo}/contents/${filePath} -X PUT -f message="${safeMessage}" -f content="${base64Content}" -f branch="${branch}"`;
  }
  return getGitHubData(cmd, ctx);
}

export function getGitHubFileContent(repo, filePath, branch = 'main', ctx) {
  const cmd = `gh api repos/${repo}/contents/${filePath}?ref=${branch} --jq '.content' | base64 -d`;
  return getGitHubData(cmd, ctx);
}

// Handle natural language GitHub request
export async function handleGitHubRequest(channelId, message, ctx) {
  const { log } = ctx;
  log('info', 'Processing natural language GitHub request', { channelId });

  const repoMatch = message.match(/(?:repo|repository)[\s:]*([^\s,]+)/i);
  const repo = repoMatch ? repoMatch[1] : null;

  try {
    if (!repo) {
      return `\u{1F4E6} **GitHub Status**\n\nTo check a specific repo, mention it like: "what's the status of repo-name on GitHub"\n\nOr use: \`!github repo-name\``;
    }

    const commits = getRecentCommits(repo, 5, ctx);
    const prs = getOpenPRs(repo, ctx);
    const issues = getOpenIssues(repo, ctx);

    return `\u{1F4E6} **GitHub: ${repo}**\n\n**Recent Commits:**\n${commits || '_None found_'}\n\n**Open PRs:**\n${prs || '_None_'}\n\n**Open Issues:**\n${issues || '_None_'}`;
  } catch (error) {
    log('error', 'Failed to process GitHub request', { error: error.message });
    return `Sorry, I couldn't fetch GitHub info. Try: \`!github repo-name\``;
  }
}

// Save content to a markdown file and commit to GitHub
export async function saveToGitHub(filename, content, commitMessage, ctx) {
  const { log } = ctx;
  try {
    if (!fs.existsSync(DOCS_PATH)) {
      fs.mkdirSync(DOCS_PATH, { recursive: true });
    }

    const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    const fullFilename = `${date}-${safeName}.md`;
    const filepath = path.join(DOCS_PATH, fullFilename);

    fs.writeFileSync(filepath, content);
    log('info', 'Wrote documentation file', { filepath });

    execSync(`git add "${filepath}"`, { cwd: REPO_PATH, encoding: 'utf8' });
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: REPO_PATH, encoding: 'utf8' });
    execSync(`git push`, { cwd: REPO_PATH, encoding: 'utf8' });

    log('info', 'Committed and pushed to GitHub', { filepath });
    return { success: true, filepath: `docs/${fullFilename}`, filename: fullFilename };
  } catch (error) {
    log('error', 'Failed to save to GitHub', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Get the last substantial bot response for saving
export function getLastBotResponse(channelMessages) {
  for (let i = channelMessages.length - 1; i >= 0; i--) {
    const msg = channelMessages[i];
    if (msg.role === 'assistant' && msg.content && msg.content.length > 200) {
      return msg.content;
    }
  }
  return null;
}
