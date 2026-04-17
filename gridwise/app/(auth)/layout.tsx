export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(0,229,255,0.12),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(124,58,237,0.2),transparent_35%),#05060c] p-6">
            <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">
                {children}
            </div>
        </main>
    );
}
