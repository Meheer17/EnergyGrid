import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { GRIDWISE_TOKEN_COOKIE } from "@/lib/constants";

export async function getServerSessionUser() {
    const token = cookies().get(GRIDWISE_TOKEN_COOKIE)?.value;

    if (!token) {
        return null;
    }

    try {
        return await verifyToken(token);
    } catch {
        return null;
    }
}
