const githubApi = "https://api.github.com";

export function githubHeaders(accept = "application/vnd.github+json"): HeadersInit {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "OpenSource-Buddy",
  };
  const token = Deno.env.get("GITHUB_TOKEN");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function fetchGitHub(path: string, accept?: string): Promise<Response> {
  return await fetch(`${githubApi}${path}`, {
    headers: githubHeaders(accept),
    signal: AbortSignal.timeout(12_000),
  });
}

export function rateLimitMessage(response: Response): string {
  const reset = response.headers.get("x-ratelimit-reset");
  const resetTime = reset ? new Date(Number(reset) * 1000).toLocaleTimeString() : null;
  return resetTime
    ? `GitHub API rate limit reached. Try again after ${resetTime} or configure a server-side GITHUB_TOKEN.`
    : "GitHub API rate limit reached. Try again later or configure a server-side GITHUB_TOKEN.";
}

export function repositoryCoordinates(repositoryUrl: string): { owner: string; repository: string } | null {
  const parts = repositoryUrl.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[parts.length - 2], repository: parts[parts.length - 1] };
}
