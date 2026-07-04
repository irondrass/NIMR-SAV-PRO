/**
 * Backend v2 foundation placeholder.
 * Confirmation will verify Drive file ownership before metadata insert.
 */

export {};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const FUNCTION_NAME = "drive-confirm-upload";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (!request.headers.get("authorization")) {
    return json(401, { error: "authenticated_user_required", function: FUNCTION_NAME });
  }

  return json(501, {
    function: FUNCTION_NAME,
    status: "prepared-only",
    nextStep: "Verify Drive file, insert file_attachments metadata, and create audit_event server-side.",
  });
});
