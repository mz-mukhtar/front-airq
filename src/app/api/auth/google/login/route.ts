import { NextResponse } from "next/server";
import { getServerApiBaseUrl, SERVER_API_VERSION } from "@/lib/api/server-config";

/** Redirect to backend Google OAuth without exposing the backend URL to client bundles. */
export async function GET() {
  const base = getServerApiBaseUrl();
  return NextResponse.redirect(`${base}/api/${SERVER_API_VERSION}/auth/google/login`);
}
