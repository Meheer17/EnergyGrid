import { NextResponse } from "next/server";
import { GRIDWISE_TOKEN_COOKIE } from "@/lib/constants";

export async function POST() {
    const response = NextResponse.json({ success: true });
    response.cookies.set({
        name: GRIDWISE_TOKEN_COOKIE,
        value: "",
        maxAge: 0,
        path: "/",
    });
    return response;
}
