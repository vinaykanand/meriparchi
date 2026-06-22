"use client";

import React from "react";
import AuthProvider from "@/components/providers/AuthProvider";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider requireSuperAdmin={true}>
      {children}
    </AuthProvider>
  );
}
