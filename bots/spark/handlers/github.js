// GitHub integration handlers for Spark
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const githubContextFile = path.join(__dirname, '..', 'github-context.json');

// GitHub context storage (module-level)
let githubContext = {
  repos: {},
  lastRefresh: null,
  summary: null
};

// Load GitHub context from file
export function loadGithubContext(log) {
  try {
    if (fs.existsSync(githubContextFile)) {
      githubContext = JSON.parse(fs.readFileSync(githubContextFile, 'utf8'));
      log('info', 'Loaded GitHub context', {
        repoCount: Object.keys(githubContext.repos).length,
        lastRefresh: githubContext.lastRefresh
      });
    }
  } catch (error) {
    log('error', 'Failed to load GitHub context', { error: error.message });
  }
}

// Save GitHub context to file
function saveGithubContext(log) {
  try {
    fs.writeFileSync(githubContextFile, JSON.stringify(githubContext, null, 2));
    log('info', 'Saved GitHub context');
  } catch (error) {
    log('error', 'Failed to save GitHub context', { error: error.message });
  }
}

// Get reference to github context (for use in commands.js etc.)
export function getGithubContext() {
  return githubContext;
}

// GitHub API helper (read-only)
async function githubApi(endpoint, method, config) {
  if (!config.github?.enabled || !config.github?.token) {
    throw new Error('GitHub integration not configured');
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const response = await fetch(url, {
    method: method || 'GET',
    headers: {
      'Authorization': `Bearer ${config.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Spark-Bot'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${error}`);
  }

  return response.json();
}

// GitHub API helper with body support for POST/PUT
async function githubApiWrite(endpoint, method, body, config) {
  if (!config.github?.enabled || !config.github?.token || config.github.token === 'YOUR_GITHUB_TOKEN') {
    throw new Error('GitHub integration not configured. Set github.token in config.json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.github.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Spark-Bot',
      'Content-Type': 'application/json'
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

// Fetch repository info
async function fetchRepoInfo(owner, repo, config, log) {
  try {
    const info = await githubApi(`/repos/${owner}/${repo}`, 'GET', config);
    return {
      name: info.name,
      fullName: info.full_name,
      description: info.description,
      language: info.language,
      defaultBranch: info.default_branch,
      topics: info.topics || [],
      stars: info.stargazers_count,
      forks: info.forks_count,
      openIssues: info.open_issues_count,
      createdAt: info.created_at,
      updatedAt: info.updated_at,
      url: info.html_url
    };
  } catch (error) {
    log('error', 'Failed to fetch repo info', { owner, repo, error: error.message });
    return null;
  }
}

// Fetch directory tree
async function fetchRepoTree(owner, repo, branch, config, log) {
  try {
    const tree = await githubApi(`/repos/${owner}/${repo}/git/trees/${branch || 'main'}?recursive=1`, 'GET', config);

    const structure = {
      directories: [],
      files: [],
      keyFiles: []
    };

    const keyFilePatterns = [
      'README.md', 'readme.md', 'README',
      'package.json', 'package-lock.json',
      'Cargo.toml', 'go.mod', 'requirements.txt', 'Pipfile',
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      '.env.example', 'config.json', 'config.yaml', 'config.yml',
      'tsconfig.json', 'webpack.config.js', 'vite.config.js',
      'Makefile', 'justfile',
      '.github/workflows'
    ];

    for (const item of tree.tree.slice(0, 500)) {
      if (item.type === 'tree' && item.path.split('/').length === 1) {
        structure.directories.push(item.path);
      } else if (item.type === 'blob') {
        if (item.path.split('/').length === 1) {
          structure.files.push(item.path);
        }
        if (keyFilePatterns.some(p => item.path.includes(p) || item.path === p)) {
          structure.keyFiles.push(item.path);
        }
      }
    }

    return structure;
  } catch (error) {
    log('error', 'Failed to fetch repo tree', { owner, repo, error: error.message });
    return null;
  }
}

// Fetch README content
async function fetchReadme(owner, repo, config, log) {
  try {
    const readme = await githubApi(`/repos/${owner}/${repo}/readme`, 'GET', config);
    const content = Buffer.from(readme.content, 'base64').toString('utf8');
    return content.length > 4000 ? content.substring(0, 4000) + '\n...(truncated)' : content;
  } catch (error) {
    log('warn', 'No README found', { owner, repo });
    return null;
  }
}

// Fetch package.json or similar config
async function fetchPackageJson(owner, repo, config) {
  try {
    const file = await githubApi(`/repos/${owner}/${repo}/contents/package.json`, 'GET', config);
    const content = Buffer.from(file.content, 'base64').toString('utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

// Fetch recent commits
export async function fetchRecentCommits(owner, repo, limit, config, log) {
  try {
    const commits = await githubApi(`/repos/${owner}/${repo}/commits?per_page=${limit || 50}`, 'GET', config);
    return commits.map(c => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date,
      url: c.html_url
    }));
  } catch (error) {
    log('error', 'Failed to fetch commits', { owner, repo, error: error.message });
    return [];
  }
}

// Fetch open pull requests
export async function fetchOpenPRs(owner, repo, limit, config, log) {
  try {
    const prs = await githubApi(`/repos/${owner}/${repo}/pulls?state=open&per_page=${limit || 20}`, 'GET', config);
    return prs.map(pr => ({
      number: pr.number,
      title: pr.title,
      author: pr.user.login,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      draft: pr.draft,
      labels: pr.labels.map(l => l.name),
      url: pr.html_url,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref
    }));
  } catch (error) {
    log('error', 'Failed to fetch PRs', { owner, repo, error: error.message });
    return [];
  }
}

// Fetch open issues (excluding PRs)
export async function fetchOpenIssues(owner, repo, limit, config, log) {
  try {
    const issues = await githubApi(`/repos/${owner}/${repo}/issues?state=open&per_page=${limit || 30}`, 'GET', config);
    return issues
      .filter(i => !i.pull_request)
      .map(i => ({
        number: i.number,
        title: i.title,
        author: i.user.login,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
        labels: i.labels.map(l => l.name),
        assignees: i.assignees.map(a => a.login),
        url: i.html_url
      }));
  } catch (error) {
    log('error', 'Failed to fetch issues', { owner, repo, error: error.message });
    return [];
  }
}

// Fetch contributors
async function fetchContributors(owner, repo, limit, config, log) {
  try {
    const contributors = await githubApi(`/repos/${owner}/${repo}/contributors?per_page=${limit || 20}`, 'GET', config);
    return contributors.map(c => ({
      login: c.login,
      contributions: c.contributions,
      url: c.html_url
    }));
  } catch (error) {
    log('error', 'Failed to fetch contributors', { owner, repo, error: error.message });
    return [];
  }
}

// Detect tech stack from repo data
function detectTechStack(info, tree, packageJson) {
  const stack = {
    language: info?.language || 'Unknown',
    frameworks: [],
    tools: [],
    infrastructure: []
  };

  if (packageJson?.dependencies) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (deps['react']) stack.frameworks.push('React');
    if (deps['vue']) stack.frameworks.push('Vue');
    if (deps['angular'] || deps['@angular/core']) stack.frameworks.push('Angular');
    if (deps['next']) stack.frameworks.push('Next.js');
    if (deps['nuxt']) stack.frameworks.push('Nuxt');
    if (deps['express']) stack.frameworks.push('Express');
    if (deps['fastify']) stack.frameworks.push('Fastify');
    if (deps['nestjs'] || deps['@nestjs/core']) stack.frameworks.push('NestJS');
    if (deps['svelte']) stack.frameworks.push('Svelte');
    if (deps['typescript']) stack.tools.push('TypeScript');
    if (deps['eslint']) stack.tools.push('ESLint');
    if (deps['prettier']) stack.tools.push('Prettier');
    if (deps['jest']) stack.tools.push('Jest');
    if (deps['vitest']) stack.tools.push('Vitest');
    if (deps['webpack']) stack.tools.push('Webpack');
    if (deps['vite']) stack.tools.push('Vite');
    if (deps['tailwindcss']) stack.tools.push('Tailwind CSS');
  }

  if (tree?.keyFiles) {
    if (tree.keyFiles.some(f => f.includes('Dockerfile'))) stack.infrastructure.push('Docker');
    if (tree.keyFiles.some(f => f.includes('docker-compose'))) stack.infrastructure.push('Docker Compose');
    if (tree.keyFiles.some(f => f.includes('.github/workflows'))) stack.infrastructure.push('GitHub Actions');
    if (tree.keyFiles.some(f => f.includes('terraform'))) stack.infrastructure.push('Terraform');
    if (tree.keyFiles.some(f => f.includes('k8s') || f.includes('kubernetes'))) stack.infrastructure.push('Kubernetes');
  }

  return stack;
}

// Generate summary for a single repo
export function generateRepoSummary(repoFullName) {
  const ctx = githubContext.repos[repoFullName];
  if (!ctx) return null;

  const { info, techStack, commits, prs, issues, contributors, structure } = ctx;

  let summary = `## ${info.fullName}\n`;
  summary += `${info.description || 'No description'}\n\n`;
  summary += `**Tech Stack:** ${techStack.language}`;
  if (techStack.frameworks.length) summary += ` | ${techStack.frameworks.join(', ')}`;
  if (techStack.tools.length) summary += ` | ${techStack.tools.join(', ')}`;
  summary += '\n\n';

  if (structure) {
    summary += `**Structure:** ${structure.directories.slice(0, 8).join(', ')}${structure.directories.length > 8 ? '...' : ''}\n\n`;
  }

  summary += `**Activity:**\n`;
  summary += `- ${prs.length} open PRs\n`;
  summary += `- ${issues.length} open issues\n`;
  summary += `- ${commits.length} recent commits\n`;
  summary += `- ${contributors.length} contributors\n\n`;

  if (prs.length > 0) {
    summary += `**Recent PRs:**\n`;
    prs.slice(0, 5).forEach(pr => {
      summary += `- #${pr.number}: ${pr.title} (by ${pr.author})\n`;
    });
    summary += '\n';
  }

  if (issues.length > 0) {
    summary += `**Open Issues:**\n`;
    issues.slice(0, 5).forEach(i => {
      summary += `- #${i.number}: ${i.title}\n`;
    });
  }

  return summary;
}

// Generate overall context summary for AI prompts
export function generateCodebaseContext() {
  const repos = Object.keys(githubContext.repos);
  if (repos.length === 0) return null;

  let context = `## Codebase Context (${repos.length} repositories)\n\n`;

  for (const repoName of repos) {
    const ctx = githubContext.repos[repoName];
    if (!ctx) continue;

    const { info, techStack, prs, issues, commits } = ctx;

    context += `### ${repoName}\n`;
    context += `${info.description || 'No description'}\n`;
    context += `Stack: ${techStack.language}${techStack.frameworks.length ? ' + ' + techStack.frameworks.join(', ') : ''}\n`;
    context += `Activity: ${prs.length} PRs, ${issues.length} issues, ${commits.length} recent commits\n`;

    if (prs.length > 0) {
      context += `Current PRs: ${prs.slice(0, 3).map(p => `#${p.number} ${p.title}`).join('; ')}\n`;
    }
    if (issues.length > 0) {
      const highPriority = issues.filter(i =>
        i.labels.some(l => l.toLowerCase().includes('bug') || l.toLowerCase().includes('critical'))
      );
      if (highPriority.length > 0) {
        context += `Priority issues: ${highPriority.slice(0, 3).map(i => `#${i.number} ${i.title}`).join('; ')}\n`;
      }
    }
    context += '\n';
  }

  return context;
}

// Full repository onboarding
export async function onboardRepository(repoFullName, ctx) {
  const { config, log } = ctx;
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) {
    return { success: false, error: 'Invalid repo format. Use: owner/repo' };
  }

  log('info', 'Onboarding repository', { repoFullName });

  try {
    const [info, tree, readme, packageJson, commits, prs, issues, contributors] = await Promise.all([
      fetchRepoInfo(owner, repo, config, log),
      fetchRepoTree(owner, repo, null, config, log).then(t => t || fetchRepoTree(owner, repo, 'master', config, log)),
      fetchReadme(owner, repo, config, log),
      fetchPackageJson(owner, repo, config),
      fetchRecentCommits(owner, repo, config.github.maxCommits || 50, config, log),
      fetchOpenPRs(owner, repo, config.github.maxPRs || 20, config, log),
      fetchOpenIssues(owner, repo, config.github.maxIssues || 30, config, log),
      fetchContributors(owner, repo, 20, config, log)
    ]);

    if (!info) {
      return { success: false, error: 'Could not access repository. Check the name and permissions.' };
    }

    const techStack = detectTechStack(info, tree, packageJson);

    githubContext.repos[repoFullName] = {
      info,
      structure: tree,
      readme,
      packageJson,
      techStack,
      commits,
      prs,
      issues,
      contributors,
      onboardedAt: new Date().toISOString()
    };

    if (!config.github.repos.includes(repoFullName)) {
      config.github.repos.push(repoFullName);
    }

    saveGithubContext(log);

    return {
      success: true,
      repo: repoFullName,
      summary: generateRepoSummary(repoFullName)
    };
  } catch (error) {
    log('error', 'Onboarding failed', { repoFullName, error: error.message });
    return { success: false, error: error.message };
  }
}

// Refresh all repositories
export async function refreshAllRepos(ctx) {
  const { config, log } = ctx;
  log('info', 'Refreshing all GitHub repositories');

  const repos = config.github.repos || [];
  const results = [];

  for (const repo of repos) {
    const result = await onboardRepository(repo, ctx);
    results.push({ repo, ...result });
  }

  githubContext.lastRefresh = new Date().toISOString();
  githubContext.summary = generateCodebaseContext();
  saveGithubContext(log);

  return results;
}

// Schedule daily refresh
export function scheduleGithubRefresh(ctx) {
  const { config, log } = ctx;
  if (!config.github?.enabled) return;

  const intervalHours = config.github.refreshIntervalHours || 24;
  const intervalMs = intervalHours * 60 * 60 * 1000;

  setInterval(async () => {
    log('info', 'Running scheduled GitHub refresh');
    await refreshAllRepos(ctx);
  }, intervalMs);

  log('info', `GitHub refresh scheduled every ${intervalHours} hours`);
}

// GitHub write functions
export async function createGitHubBranch(owner, repo, branchName, fromBranch, config, log) {
  try {
    const ref = await githubApi(`/repos/${owner}/${repo}/git/refs/heads/${fromBranch || 'main'}`, 'GET', config);
    const sha = ref.object.sha;
    await githubApiWrite(`/repos/${owner}/${repo}/git/refs`, 'POST', {
      ref: `refs/heads/${branchName}`,
      sha: sha
    }, config);
    return { success: true, branch: branchName, sha };
  } catch (error) {
    log('error', 'Failed to create branch', { owner, repo, branchName, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function createGitHubPR(owner, repo, title, body, headBranch, baseBranch, config, log) {
  try {
    const result = await githubApiWrite(`/repos/${owner}/${repo}/pulls`, 'POST', {
      title, body, head: headBranch, base: baseBranch || 'main'
    }, config);
    return { success: true, number: result.number, url: result.html_url };
  } catch (error) {
    log('error', 'Failed to create PR', { owner, repo, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function createGitHubIssue(owner, repo, title, body, labels, config, log) {
  try {
    const result = await githubApiWrite(`/repos/${owner}/${repo}/issues`, 'POST', {
      title, body, labels: labels || []
    }, config);
    return { success: true, number: result.number, url: result.html_url };
  } catch (error) {
    log('error', 'Failed to create issue', { owner, repo, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function commentOnGitHub(owner, repo, issueNumber, comment, config, log) {
  try {
    const result = await githubApiWrite(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, 'POST', {
      body: comment
    }, config);
    return { success: true, id: result.id, url: result.html_url };
  } catch (error) {
    log('error', 'Failed to comment', { owner, repo, issueNumber, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function updateGitHubFile(owner, repo, filePath, content, commitMessage, branch, config, log) {
  try {
    let sha = null;
    try {
      const existing = await githubApi(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch || 'main'}`, 'GET', config);
      sha = existing.sha;
    } catch (e) { /* File doesn't exist */ }

    const body = {
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch: branch || 'main'
    };
    if (sha) body.sha = sha;

    const result = await githubApiWrite(`/repos/${owner}/${repo}/contents/${filePath}`, 'PUT', body, config);
    return { success: true, sha: result.content.sha, url: result.content.html_url };
  } catch (error) {
    log('error', 'Failed to update file', { owner, repo, filePath, error: error.message });
    return { success: false, error: error.message };
  }
}

export async function getGitHubFileContent(owner, repo, filePath, branch, config) {
  try {
    const file = await githubApi(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch || 'main'}`, 'GET', config);
    return {
      success: true,
      content: Buffer.from(file.content, 'base64').toString('utf8'),
      sha: file.sha
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Handle natural language GitHub request
export async function handleGitHubRequest(channelId, message, ctx) {
  const { config, log } = ctx;

  log('info', 'Processing natural language GitHub request', { channelId });

  const repoMatch = message.match(/(?:repo|repository)[\s:]*([^\s,]+)/i);
  const repo = repoMatch ? repoMatch[1] : null;

  try {
    if (!config.github?.enabled || !config.github?.token || config.github?.token === 'YOUR_GITHUB_TOKEN') {
      return `\ud83d\udce6 **GitHub Status**\n\nGitHub integration isn't configured yet. Ask your admin to add a GitHub token to config.json!`;
    }

    if (!repo && (!config.github.repos || config.github.repos.length === 0)) {
      return `\ud83d\udce6 **GitHub Status**\n\nTo check a specific repo, mention it like: "what's the status of repo-name on GitHub"\n\nNo repos are configured for monitoring.`;
    }

    if (!repo && config.github.repos?.length > 0) {
      let summaryParts = [];
      for (const repoName of config.github.repos.slice(0, 3)) {
        try {
          const [owner, name] = repoName.includes('/') ? repoName.split('/') : [null, repoName];
          if (owner && name) {
            const commits = await fetchRecentCommits(owner, name, 3, config, log);
            const prs = await fetchOpenPRs(owner, name, 20, config, log);
            summaryParts.push(`**${repoName}**: ${commits?.length || 0} recent commits, ${prs?.length || 0} open PRs`);
          }
        } catch (e) {
          summaryParts.push(`**${repoName}**: Unable to fetch`);
        }
      }
      return `\ud83d\udce6 **GitHub Overview**\n\n${summaryParts.join('\n')}`;
    }

    const [owner, name] = repo.includes('/') ? repo.split('/') : [null, repo];
    if (!owner || !name) {
      return `\ud83d\udce6 Please specify the repo as "owner/repo-name"`;
    }

    const commits = await fetchRecentCommits(owner, name, 5, config, log);
    const prs = await fetchOpenPRs(owner, name, 20, config, log);
    const issues = await fetchOpenIssues(owner, name, 30, config, log);

    const commitList = commits?.slice(0, 5).map(c => `\u2022 \`${c.sha}\` ${c.message} (${c.author})`).join('\n') || '_None_';
    const prList = prs?.slice(0, 5).map(p => `\u2022 #${p.number}: ${p.title}`).join('\n') || '_None_';
    const issueList = issues?.slice(0, 5).map(i => `\u2022 #${i.number}: ${i.title}`).join('\n') || '_None_';

    return `\ud83d\udce6 **GitHub: ${repo}**\n\n**Recent Commits:**\n${commitList}\n\n**Open PRs:**\n${prList}\n\n**Open Issues:**\n${issueList}`;
  } catch (error) {
    log('error', 'Failed to process GitHub request', { error: error.message });
    return `Sorry, I couldn't fetch GitHub info. Make sure the repo exists and the token has access.`;
  }
}
