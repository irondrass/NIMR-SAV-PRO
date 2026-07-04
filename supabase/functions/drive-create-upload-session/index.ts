/**
 * Backend v2 foundation placeholder.
 * No Google Drive secret or direct frontend Drive URL is present here.
 */

export {};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

const FUNCTION_NAME = "drive-create-upload-session";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return json(401, { error: "authenticated_user_required", function: FUNCTION_NAME });
  }

  const ownerEmail = Deno.env.get("GOOGLE_DRIVE_OWNER_EMAIL") ?? "not-configured";
  return json(501, {
    function: FUNCTION_NAME,
    status: "prepared-only",
    ownerEmailConfigured: ownerEmail !== "not-configured",
    nextStep: "Validate role, dossier access, Drive folder, then return a backend upload endpoint.",
  });
});
