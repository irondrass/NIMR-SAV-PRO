/**
 * Backend v2 foundation placeholder.
 * This phase allows metadata-only logical delete design, not binary deletion.
 */

export {};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const FUNCTION_NAME = "drive-delete-metadata";

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
    googleDriveReal: "not-active",
    binaryDeletion: false,
    requiredControls: ["authenticated_user", "role_allowed", "dossier_access", "file_metadata", "audit_logs"],
    nextStep: "Mark file_metadata deleted, keep binary deletion disabled until a later controlled phase, and audit the action.",
  });
});
