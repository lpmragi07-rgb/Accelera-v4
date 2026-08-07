import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeamPanel from "@/components/TeamPanel";

export default async function EquipePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <TeamPanel userEmail={user.email ?? null} />;
}
