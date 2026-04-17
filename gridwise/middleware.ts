import { NextResponse, type NextRequest } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";
import { AUTH_ROLE_HOME, GRIDWISE_TOKEN_COOKIE } from "@/lib/constants";

function redirectToLogin(req: NextRequest) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
}

export async function middleware(req: NextRequest) {
    const token = req.cookies.get(GRIDWISE_TOKEN_COOKIE)?.value;

    if (!token) {
        return redirectToLogin(req);
    }

    try {
        const payload = await verifyTokenEdge(token);
        const pathname = req.nextUrl.pathname;

        const rolePath = AUTH_ROLE_HOME[payload.role];
        const isRolePath = pathname.startsWith(rolePath);

        if (!isRolePath) {
            return NextResponse.redirect(new URL(rolePath, req.url));
        }

        return NextResponse.next();
    } catch {
        return redirectToLogin(req);
    }
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
