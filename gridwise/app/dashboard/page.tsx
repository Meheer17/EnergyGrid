import { redirect } from "next/navigation";
import { AUTH_ROLE_HOME } from "@/lib/constants";
import { getServerSessionUser } from "@/lib/session";

export default async function DashboardEntryPage() {
    const user = await getServerSessionUser();

    if (!user) {
        redirect("/login");
    }

    redirect(AUTH_ROLE_HOME[user.role] ?? "/dashboard/consumer");
}
