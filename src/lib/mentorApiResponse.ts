import type { ContributionGuide } from "../types/domain";

export interface MentorApiResponse {
  guide?: ContributionGuide;
  error?: string;
}

export async function readMentorApiResponse(response: Response): Promise<MentorApiResponse> {
  let body: string;
  try {
    body = await response.text();
  } catch {
    throw new Error("Could not read the AI mentor API response. Please retry.");
  }

  try {
    return JSON.parse(body) as MentorApiResponse;
  } catch {
    const contentType = response.headers.get("content-type") ?? "";
    if (/text\/html/i.test(contentType) || /^\s*</.test(body)) {
      throw new Error(
        "The AI mentor API returned the website page instead of JSON. Restart `npm run dev` and verify the local AI mentor backend is running.",
      );
    }
    throw new Error(`The AI mentor API returned a non-JSON response (HTTP ${response.status}).`);
  }
}
