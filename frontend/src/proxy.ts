import { NextRequest, NextResponse } from "next/server";

function roleTarget(role: string | undefined) {
  if (role === "ADMIN") return "/portal/admin";
  if (role === "AGENT") return "/portal/agent";
  return "/portal/user";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("comutel_access_token")?.value;
  const role = request.cookies.get("comutel_role")?.value;

  if (pathname === "/login" && token) {
    const url = request.nextUrl.clone();
    url.pathname = roleTarget(role);
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith("/portal")) {
    return NextResponse.next();
  }

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/portal/admin") && role !== "ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = roleTarget(role);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/portal/agent") && role !== "AGENT" && role !== "ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/user";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/portal/:path*"],
};
