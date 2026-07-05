/**
 * Backend v2 foundation placeholder.
 * Downloads must go through this backend function, never a raw Drive URL.
 */

export {};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const FUNCTION_NAME = "drive-download";

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
    publicDriveUrl: false,
    requiredControls: ["authenticated_user", "role_allowed", "dossier_access", "file_metadata", "ownership_check", "audit_logs"],
    nextStep: "Verify dossier rights, verify file_metadata row, stream via backend only, and create an audit_logs entry for every access.",
  });
});
