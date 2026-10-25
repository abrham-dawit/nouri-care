import { NextResponse, type NextRequest } from "next/server";
import { canOpenPage, homeFor, PUBLIC_PATHS } from "@/lib/auth/access";
import { SESSION_COOKIE, verifyToken } from "@/lib/auth/token";

/**
 * First gate on every request: signed-out visitors go to /login, and signed-in users only reach
 * pages their role (and their patients) allow. API routes re-check access themselves.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const user = verifyToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    // Auth endpoints are open; device and agent endpoints use their own server-issued credentials.
    if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/v1/")) return NextResponse.next();
    return user ? NextResponse.next() : NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // The intro plays on "/" for signed-out visitors, then hands over to /login.
  if (pathname === "/") return user ? NextResponse.redirect(new URL(homeFor(user), request.url)) : NextResponse.next();

  if (PUBLIC_PATHS.includes(pathname)) return user ? NextResponse.redirect(new URL(homeFor(user), request.url)) : NextResponse.next();

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  if (!canOpenPage(user, pathname)) return NextResponse.redirect(new URL(homeFor(user), request.url));
  return NextResponse.next();
}

export const config = {
  // Everything except Next's own assets and files with an extension (images, models, fonts).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[A-Za-z0-9]+$).*)"],
};
