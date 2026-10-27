import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  fetch: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

import handler, { type MentorRequest, type MentorResponse } from "../server/ai-mentor";

const guide = {
  issue_explanation: "The issue describes a keyboard navigation problem.",
  expected_outcome: "Keyboard users can move through the menu.",
  solution_approach: "Trace the menu focus behavior and correct the key handling without changing unrelated interactions.",
  prerequisites: ["Basic TypeScript and keyboard accessibility knowledge."],
  repository_setup_workflow: [
    "Read the repository README and contribution instructions.",
    "Follow the setup steps documented by the project.",
    "Create a branch from the current default branch.",
  ],
  possible_root_causes: ["A focus handler may not update the active item."],
  files_to_inspect: ["Suggested area only: menu keyboard event handling."],
  implementation_steps: [
    "Read the issue carefully and write down the expected keyboard behavior.",
    "Reproduce the problem with the same menu interaction described by the issue.",
    "Inspect the related keyboard and focus handling, starting with areas explicitly named in the issue.",
    "Trace how focus changes for each supported key and compare it with the expected behavior.",
    "Make the smallest change that addresses the mismatch without changing unrelated menu behavior.",
    "Add or update focused tests for the expected key behavior and relevant edge cases.",
  ],
  example_code: "// Illustrative only",
  test_commands: ["Check repository instructions for the appropriate test command."],
  edge_cases: ["The menu contains no focusable items."],
  pull_request_checklist: ["Link the issue.", "Describe and verify the change."],
};

function makeRequest(
  body: unknown = {
    issueId: 55,
    user_id: "untrusted-browser-user",
    title: "Keyboard navigation is broken",
    body: "Arrow keys do not move focus.",
    url: "https://github.com/example/menu/issues/4",
    repository: "example/menu",
    labels: ["help wanted"],
    language: "TypeScript",
  },
  options: { method?: string; origin?: string; authorization?: string } = {},
): MentorRequest {
  return {
    method: options.method ?? "POST",
    headers: {
      host: "localhost:5173",
      origin: options.origin ?? "http://localhost:5173",
      authorization: options.authorization ?? "Bearer test-user-token",
      "content-type": "application/json",
    },
    body,
  } as MentorRequest;
}

function makeResponse() {
  const state: { statusCode: number; headers: Record<string, string>; body?: unknown } = {
    statusCode: 200,
    headers: {},
  };
  const response = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return this;
    },
    json(value: unknown) {
      state.body = value;
      return this;
    },
    end() {
      return this;
    },
  };
  return { response: response as MentorResponse, state };
}

describe("Local AI mentor API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("OPENROUTER_API_KEY", "server-test-key");
    vi.stubEnv("OPENROUTER_MODEL", "openai/gpt-4o-mini");
    vi.stubEnv("SUPABASE_URL", "https://supabase.example");
    vi.stubEnv("SUPABASE_ANON_KEY", "public-anon-key");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("NODE_ENV", "development");
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "verified-user-id" } },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.createClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
      from: vi.fn(() => ({ insert: mocks.insert })),
    });
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(guide) } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("authenticates, requests a structured guide, and saves through the user's RLS session", async () => {
    const { response, state } = makeResponse();
    await handler(makeRequest() , response);

    expect(state.statusCode).toBe(200);
    expect((state.body as { guide: typeof guide }).guide.issue_explanation).toBe(guide.issue_explanation);
    expect((state.body as { guide: typeof guide & { context_note: string } }).guide.context_note).toMatch(/not inspected/);
    expect(mocks.getUser).toHaveBeenCalledWith("test-user-token");
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://supabase.example",
      "public-anon-key",
      expect.objectContaining({ global: { headers: { Authorization: "Bearer test-user-token" } } }),
    );
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "verified-user-id",
      issue_id: 55,
      model: "openai/gpt-4o-mini",
    }));
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer server-test-key" }),
      }),
    );
    expect(state.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    const requestBody = JSON.parse(mocks.fetch.mock.calls[0][1].body as string) as {
      max_tokens: number;
      messages: Array<{ content: string }>;
    };
    expect(requestBody.max_tokens).toBe(6000);
    expect(requestBody.messages[0].content).toMatch(/5-6 short, ordered actions/);
    expect((state.body as { guide: typeof guide & { setup: string[] } }).guide.setup)
      .toEqual(guide.repository_setup_workflow);
  });

  it("requires authentication and does not call OpenRouter for invalid sessions", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid token") });
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(401);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects malformed or mismatched GitHub issue URLs", async () => {
    const { response, state } = makeResponse();
    await handler(makeRequest({
      title: "Issue",
      body: null,
      url: "https://github.com/other/repo/issues/4",
      repository: "example/menu",
      labels: [],
      language: null,
    }), response);

    expect(state.statusCode).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns a clear configuration error when the OpenRouter key is missing", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(503);
    expect(state.body).toEqual(expect.objectContaining({ error: expect.stringContaining("OPENROUTER_API_KEY") }));
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("preserves OpenRouter rate-limit errors as HTTP 429", async () => {
    mocks.fetch.mockResolvedValue(new Response("{}", { status: 429 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(429);
  });

  it("returns an actionable response when OpenRouter exceeds the request timeout", async () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    mocks.fetch.mockRejectedValue(timeout);
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(504);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("within 60 seconds"),
    }));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns clear CORS preflight and method responses", async () => {
    const options = makeResponse();
    await handler(makeRequest(undefined, { method: "OPTIONS" }), options.response);
    expect(options.state.statusCode).toBe(204);
    expect(options.state.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");

    const get = makeResponse();
    await handler(makeRequest(undefined, { method: "GET" }), get.response);
    expect(get.state.statusCode).toBe(405);
  });

  it("rejects oversized issue requests before contacting OpenRouter", async () => {
    const { response, state } = makeResponse();
    await handler(makeRequest({
      title: "Issue",
      body: "x".repeat(25_000),
      url: "https://github.com/example/menu/issues/4",
      repository: "example/menu",
      labels: [],
      language: null,
    }), response);

    expect(state.statusCode).toBe(413);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid OpenRouter guide JSON without saving it", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: '{"issue_explanation":"partial"}' } }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("accepts OpenRouter text content returned as text parts", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: "stop",
        message: {
          content: [{ type: "text", text: JSON.stringify(guide) }],
        },
      }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(200);
    expect((state.body as { guide: typeof guide }).guide.issue_explanation).toBe(guide.issue_explanation);
  });

  it("explains when OpenRouter cuts off generation at its output limit", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        finish_reason: "length",
        message: { content: '{"issue_explanation":"partial' },
      }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("stopped before completing"),
    }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns an actionable error when OpenRouter returns no content", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: null } }],
    }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("returned no guide text"),
    }));
  });

  it("retries once when OpenRouter returns malformed response JSON", async () => {
    mocks.fetch
      .mockResolvedValueOnce(new Response("<html>temporary upstream error</html>", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(guide) } }],
      }), { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect((state.body as { guide: typeof guide }).guide.issue_explanation).toBe(guide.issue_explanation);
  });

  it("returns a retryable error if both OpenRouter response bodies are malformed", async () => {
    mocks.fetch
      .mockResolvedValueOnce(new Response("not JSON", { status: 200 }))
      .mockResolvedValueOnce(new Response("still not JSON", { status: 200 }));
    const { response, state } = makeResponse();
    await handler(makeRequest(), response);

    expect(state.statusCode).toBe(502);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(state.body).toEqual(expect.objectContaining({
      error: expect.stringContaining("malformed response JSON twice"),
    }));
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not allow a browser-supplied user id to own the saved guide", async () => {
    const { response } = makeResponse();
    await handler(makeRequest(), response);

    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "verified-user-id" }));
    expect(mocks.insert).not.toHaveBeenCalledWith(expect.objectContaining({ user_id: "untrusted-browser-user" }));
  });
});
