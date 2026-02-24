import { exec } from "child_process";
import { promisify } from "util";
const execPromise = promisify(exec);

const URL_PATTERN = /(https?:\/\/[^\s]+)|(site:\/\/[^\s]+)/g;
const HTML_TAGS = /<[^>]*>/g;
const SCRIPTS = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
const STYLES = /<style\b[^>]*>([\s\S]*?)<\/style>/gm;
const NAV_HEADER_FOOTER = /<(nav|header|footer|aside)\b[^>]*>([\s\S]*?)<\/\1>/gm;
const SVG_ELEMENTS = /<svg\b[^>]*>([\s\S]*?)<\/svg>/gm;

export function extractUrls(text) {
  const matches = text.match(URL_PATTERN) || [];
  console.log(`[DEBUG] Extracted URLs: ${JSON.stringify(matches)}`);
  return matches;
}

// Check if URL is a GitHub repo and try to get README
async function tryGitHubReadme(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;

  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, '').split('/')[0].split('?')[0].split('#')[0];

  // Try common README locations
  const readmeUrls = [
    `https://raw.githubusercontent.com/${owner}/${repoName}/main/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repoName}/master/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repoName}/main/readme.md`,
    `https://raw.githubusercontent.com/${owner}/${repoName}/master/readme.md`
  ];

  for (const readmeUrl of readmeUrls) {
    try {
      const cmd = `curl -s -w "\\n%{http_code}" --max-time 5 "${readmeUrl}"`;
      const { stdout } = await execPromise(cmd);
      const lines = stdout.trim().split('\n');
      const httpCode = lines.pop();
      const content = lines.join('\n');

      if (httpCode === '200' && content.length > 100) {
        console.log(`[DEBUG] Found README at ${readmeUrl}`);
        return { content: content, source: readmeUrl };
      }
    } catch (e) {
      // Try next URL
    }
  }
  return null;
}

export async function fetchWebPage(url) {
  console.log(`[DEBUG] Fetching URL: ${url}`);
  try {
    if (!/^https?:\/\/[a-zA-Z0-9-._~:/?#\[\]@!$&'()*+,;=%]+$/.test(url)) {
        console.log(`[DEBUG] Skipped unsafe URL: ${url}`);
        return `[Skipped unsafe URL: ${url}]`;
    }

    // Special handling for GitHub repos - try to get README first
    if (url.includes('github.com')) {
      const readme = await tryGitHubReadme(url);
      if (readme) {
        let content = readme.content;
        if (content.length > 6000) {
          content = content.substring(0, 6000) + "\n\n... [Truncated]";
        }
        return `[GitHub README from ${url}]:\n\n${content}`;
      }
    }

    const cmd = `curl -L -s --max-time 10 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${url}"`;
    const { stdout, stderr } = await execPromise(cmd);

    if (!stdout) {
        console.log(`[DEBUG] Empty stdout for ${url}. Stderr: ${stderr}`);
        return `[Empty response from ${url}]`;
    }

    console.log(`[DEBUG] Curl success for ${url}, received ${stdout.length} chars`);

    // Try to extract main content area first
    let mainContent = '';
    const mainMatch = stdout.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
                      stdout.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                      stdout.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (mainMatch) {
      mainContent = mainMatch[1];
    } else {
      mainContent = stdout;
    }

    let text = mainContent
      .replace(SCRIPTS, "")
      .replace(STYLES, "")
      .replace(NAV_HEADER_FOOTER, "")
      .replace(SVG_ELEMENTS, "")
      .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, "\n\n## $2\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/td>/gi, " | ")
      .replace(/<\/th>/gi, " | ")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
      .replace(HTML_TAGS, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text.length > 5000) {
      text = text.substring(0, 5000) + "\n\n... [Truncated]";
    }

    return `[Content from ${url}]:\n\n${text}`;

  } catch (err) {
    console.log(`[DEBUG] Fetch error for ${url}: ${err.message}`);
    return `[Failed to fetch ${url}: ${err.message}]`;
  }
}

// Mock mmApi if not provided
const defaultMmApi = async () => ({});

export async function resolveSiteLink(url, mmApi = defaultMmApi) {
  try {
    const parts = url.replace("site://", "").split("/");
    const type = parts[0];
    const id = parts[1];

    if (type === "channel") {
      let channel;
      try {
        channel = await mmApi(`/channels/${id}`);
      } catch (e) {
        return `[Could not resolve channel ID: ${id}]`;
      }
      return `[Internal Channel: ${channel.display_name} (ID: ${channel.id})]\nPurpose: ${channel.purpose}\nHeader: ${channel.header}`;
    }
    // ... other types omitted for brevity, unlikely used yet ...
    return `[Unknown site resource type: ${type}]`;
  } catch (err) {
    return `[Error resolving ${url}: ${err.message}]`;
  }
}

export async function processUrls(text, mmApi) {
  const urls = extractUrls(text);
  if (!urls || urls.length === 0) return null;

  const results = await Promise.all(urls.map(async (url) => {
    if (url.startsWith("site://")) {
      return await resolveSiteLink(url, mmApi);
    } else {
      return await fetchWebPage(url);
    }
  }));

  return results.join("\n\n");
}
