"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, ChevronRight, AlertCircle, Info, FileText } from "lucide-react";
import Link from "next/link";
import { useRecordsStore } from "./RecordsProvider";
import { backendJsonFetch } from "@/lib/auth-state";

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const { notifications, dashboardStats } = useRecordsStore();
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await backendJsonFetch(`/notifications/${id}/read`, { method: "POST" });
      // In a real app we'd trigger a store refresh here
      // For now we'll just reload the page or optimistically update if we had a setter
      window.location.reload();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setOpen(!open)}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition ${open ? 'bg-[#163B8C] text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full border-2 border-white bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 mb-2">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {unreadCount} New
              </span>
            )}
          </div>
          
          <div className="flex max-h-[400px] flex-col gap-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50">
                  <Bell className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-600">No notifications yet</p>
                <p className="text-xs text-slate-400">When you receive notifications, they will show up here.</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const isUnread = !notification.readAt;
                
                let Icon = Info;
                let iconColor = "text-blue-500";
                let bgColor = "bg-blue-50";
                
                if (notification.status === "FAILED") {
                  Icon = AlertCircle;
                  iconColor = "text-red-500";
                  bgColor = "bg-red-50";
                } else if (notification.status === "SENT") {
                  Icon = CheckCircle2;
                  iconColor = "text-emerald-500";
                  bgColor = "bg-emerald-50";
                }

                return (
                  <div 
                    key={notification.id} 
                    className={`relative flex items-start gap-3 rounded-lg p-3 transition hover:bg-slate-50 ${isUnread ? 'bg-blue-50/30' : ''}`}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bgColor}`}>
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-slate-400">
                        {new Date(notification.createdAt).toLocaleDateString()} at {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                    {isUnread && (
                      <button 
                        onClick={(e) => handleMarkAsRead(notification.id, e)}
                        className="shrink-0 p-1 text-slate-400 hover:text-blue-600"
                        title="Mark as read"
                      >
                        <div className="h-2 w-2 rounded-full bg-blue-600" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          <div className="mt-2 border-t border-slate-100 p-2">
            <Link 
              href="/dashboard/profile" 
              className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              View all notification settings
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
