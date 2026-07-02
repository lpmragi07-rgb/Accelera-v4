import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/Dashboard";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O middleware já protege, mas garantimos aqui também.
  if (!user) {
    redirect("/login");
  }

  return <Dashboard userId={user.id} userEmail={user.email ?? null} />;
}
