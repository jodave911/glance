"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    HardDrive,
    Users,
    FolderOpen,
    Server,
    FileText,
    Settings,
    Shield,
    LogOut,
    Moon,
    Sun,
    ChevronLeft,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/shares", icon: HardDrive, label: "Shares" },
    { href: "/users", icon: Users, label: "Users" },
    { href: "/files", icon: FolderOpen, label: "Files" },
    { href: "/services", icon: Server, label: "Services" },
    { href: "/logs", icon: FileText, label: "Logs" },
    { href: "/settings", icon: Settings, label: "Settings" },
    { href: "/audit", icon: Shield, label: "Audit Log" },
];

export function AppSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [collapsed, setCollapsed] = useState(false);

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } finally {
            router.push("/login");
        }
    };

    return (
        <aside
            className={`fixed top-0 left-0 h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 z-40 ${collapsed ? "w-[68px]" : "w-[260px]"
                }`}
        >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <Server className="w-4 h-4 text-primary-foreground" />
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <h1 className="text-sm font-bold text-sidebar-foreground truncate">Glance</h1>
                        <p className="text-[10px] text-muted-foreground truncate">Secure Samba Manager</p>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground transition-smooth shrink-0"
                >
                    <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-3 px-2">
                <div className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth group ${isActive
                                    ? "bg-sidebar-accent text-sidebar-primary"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    }`}
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon
                                    className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                                        }`}
                                />
                                {!collapsed && <span className="truncate">{item.label}</span>}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Footer */}
            <div className="border-t border-sidebar-border p-2 space-y-1 shrink-0">
                <button
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-smooth w-full"
                    title={collapsed ? "Toggle theme" : undefined}
                >
                    {theme === "dark" ? (
                        <Sun className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                    ) : (
                        <Moon className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
                    )}
                    {!collapsed && <span>Toggle Theme</span>}
                </button>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-smooth w-full"
                    title={collapsed ? "Logout" : undefined}
                >
                    <LogOut className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
}
