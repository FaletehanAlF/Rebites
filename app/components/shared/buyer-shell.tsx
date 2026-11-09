"use client";
import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { cn } from "@/lib/utils";
import { BuyerTopbar } from "./navbar";
import { BUYER_CONTENT_OFFSET_CLASS, BuyerSidebarNav, } from "./profile-sidebar-nav";
import { MobileNavbar } from "./MobileNavbar";
import { MobileBottomNav } from "./MobileBottomNav";
import { NotificationAlertPopup } from "@/app/components/notification/notification-alert-popup";
const SIDEBAR_COLLAPSED_KEY = "rebites-buyer-sidebar-collapsed";
export const SIDEBAR_COLLAPSED_CHANGED_EVENT = "rebites-buyer-sidebar-collapsed-changed";
export function getSidebarCollapsedPreference(): boolean {
    try {
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    }
    catch {
        return false;
    }
}
export function setSidebarCollapsedPreference(collapsed: boolean) {
    try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    }
    catch {
    }
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGED_EVENT));
}
interface BuyerShellProps {
    children: React.ReactNode;
    showBottomNav?: boolean;
}
export function BuyerShell({ children, showBottomNav = true, }: BuyerShellProps) {
    const [collapsed, setCollapsed] = useState(false);
    useEffect(() => {
        setCollapsed(getSidebarCollapsedPreference());
        const onPreferenceChange = () => setCollapsed(getSidebarCollapsedPreference());
        window.addEventListener(SIDEBAR_COLLAPSED_CHANGED_EVENT, onPreferenceChange);
        window.addEventListener("storage", onPreferenceChange);
        return () => {
            window.removeEventListener(SIDEBAR_COLLAPSED_CHANGED_EVENT, onPreferenceChange);
            window.removeEventListener("storage", onPreferenceChange);
        };
    }, []);
    const toggleCollapsed = () => {
        setCollapsed((value) => {
            const next = !value;
            try {
                window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
            }
            catch {
            }
            return next;
        });
    };
    return (<MotionConfig reducedMotion="user">

      <div className="min-h-screen bg-white">

        <div className="lg:hidden">

          <MobileNavbar />

        </div>



        <BuyerTopbar collapsed={collapsed}/>

        <BuyerSidebarNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed}/>



        <div className={cn("min-w-0 pt-14 transition-[padding] duration-200 ease-out lg:pt-16", collapsed
            ? BUYER_CONTENT_OFFSET_CLASS.collapsed
            : BUYER_CONTENT_OFFSET_CLASS.expanded)}>

          {children}

          {showBottomNav && <MobileBottomNav />}

        </div>

        

        <NotificationAlertPopup />

      </div>

    </MotionConfig>);
}
