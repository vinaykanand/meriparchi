"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface Session {
  orgcode: string;
  userid: string;
  isadmin: boolean;
  issuperadmin?: boolean;
}

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({
  children,
  requireAdmin = false,
  requireSuperAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/verify");
        const data = await res.json();
        
        if (res.ok && data.success) {
          if (data.issuperadmin) {
            if (pathname !== "/dashboard/super-admin") {
              router.push("/dashboard/super-admin");
              return;
            }
          } else {
            if (requireSuperAdmin) {
              router.push(data.isadmin ? "/dashboard/admin" : "/dashboard/user");
              return;
            }
            if (requireAdmin && !data.isadmin) {
              router.push("/dashboard/user");
              return;
            }
            if (!requireAdmin && data.isadmin) {
              router.push("/dashboard/admin");
              return;
            }
          }
          
          const sessionObj = {
            orgcode: data.orgcode,
            userid: data.userid,
            isadmin: data.isadmin,
            issuperadmin: !!data.issuperadmin,
          };
          localStorage.setItem("parchi_session", JSON.stringify(sessionObj));
          setSession(sessionObj);
        } else {
          // Unauthenticated
          localStorage.removeItem("parchi_session");
          document.cookie = "authtoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          document.cookie = "orgcode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          router.push("/");
        }
      } catch (e) {
        console.error("Auth check failed:", e);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [requireAdmin, requireSuperAdmin, pathname, router]);

  const logout = () => {
    if (session) {
      fetch(`/api/logout?orgcode=${session.orgcode}`, { method: "POST" }).catch((err) =>
        console.error("Failed to log logout action:", err)
      );
    }
    localStorage.removeItem("parchi_session");
    document.cookie = "authtoken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    document.cookie = "orgcode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Authenticating...</p>
      </div>
    );
  }

  // Ensure they don't render content if they don't have a session
  if (!session) return null;

  return (
    <AuthContext.Provider value={{ session, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
