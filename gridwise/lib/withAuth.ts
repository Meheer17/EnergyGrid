import { NextResponse, type NextRequest } from "next/server";
import { GRIDWISE_TOKEN_COOKIE } from "@/lib/constants";
import { verifyToken, type GridwiseTokenPayload, type UserRole } from "@/lib/auth";

type HandlerContext<TParams extends Record<string, string> = Record<string, string>> = {
    user: GridwiseTokenPayload;
    params?: TParams;
};

type AuthedHandler<TParams extends Record<string, string> = Record<string, string>> = (
    req: NextRequest,
    ctx: HandlerContext<TParams>
) => Promise<NextResponse>;

export function withAuth<TParams extends Record<string, string> = Record<string, string>>(
    handler: AuthedHandler<TParams>,
    allowedRoles: UserRole[] = []
) {
    return async (req: NextRequest, context?: { params?: TParams }) => {
        const token = req.cookies.get(GRIDWISE_TOKEN_COOKIE)?.value;

        if (!token) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
            const user = await verifyToken(token);

            if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            return handler(req, { user, params: context?.params });
        } catch {
            return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
        }
    };
}
