import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RelatorioDashboard from "@/components/RelatorioDashboard";

export default async function RelatorioPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <RelatorioDashboard userId={user.id} userEmail={user.email ?? null} />;
}
