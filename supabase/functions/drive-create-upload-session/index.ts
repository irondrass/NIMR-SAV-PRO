/**
 * Backend v2 foundation placeholder.
 * No Google Drive secret or direct frontend Drive URL is present here.
 */

export {};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
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

  return json(501, {
    function: FUNCTION_NAME,
    status: "prepared-only",
    googleDriveReal: "not-active",
    publicDirectUpload: false,
    requiredControls: ["authenticated_user", "role_allowed", "dossier_access", "drive_folder_allowed", "audit_logs"],
    nextStep: "Validate role, dossier access and Drive folder, then return only a backend-controlled upload endpoint.",
  });
});
