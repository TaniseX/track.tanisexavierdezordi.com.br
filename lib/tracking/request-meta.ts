import "server-only";
import { ipAddress } from "@vercel/functions";
import type { NextRequest } from "next/server";

export function getClientIp(request: NextRequest): string | null {
  return ipAddress(request) ?? null;
}

export function getUserAgent(request: NextRequest): string | null {
  return request.headers.get("user-agent");
}
