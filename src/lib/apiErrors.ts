export async function getFunctionErrorMessage(message: string, context: unknown): Promise<string> {
  if (!(context instanceof Response)) return message;
  try {
    const payload: unknown = await context.clone().json();
    if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      const error = Reflect.get(payload, "error");
      const detail = Reflect.get(payload, "message");
      if (typeof error === "string") return error;
      if (typeof detail === "string") return detail;
    }
  } catch {
    return message;
  }
  return message;
}
