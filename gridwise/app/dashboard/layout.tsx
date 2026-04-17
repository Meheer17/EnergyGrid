import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { getServerSessionUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const user = await getServerSessionUser();

    if (!user) {
        redirect("/login");
    }

    return <DashboardShell user={user}>{children}</DashboardShell>;
}
