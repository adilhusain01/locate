import { NextResponse, type NextRequest } from "next/server";

/// Stock Tokens may not be offered to US persons, and the issuer names Canada, the United Kingdom and
/// Switzerland as restricted. The app shows a block page in those regions; the contracts themselves are open.
const RESTRICTED = new Set(["US", "CA", "GB", "CH"]);

export function proxy(request: NextRequest) {
  const country = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry") ?? "";
  const acknowledged = request.cookies.get("locate_ack")?.value === "1";
  if (RESTRICTED.has(country.toUpperCase()) && !acknowledged) {
    const url = new URL("/restricted", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*"] };
