import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider } from "@/components/auth-provider";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <div className="flex min-h-screen">
                <AppSidebar />
                <main className="flex-1 ml-[260px] transition-all duration-300">
                    <div className="p-8 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </AuthProvider>
    );
}
