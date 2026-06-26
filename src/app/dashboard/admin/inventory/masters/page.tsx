"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MastersPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/admin/inventory/locations");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
      Redirecting to Locations...
    </div>
  );
}
