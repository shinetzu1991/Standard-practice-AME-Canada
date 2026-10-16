import Home from "./Home";
import { ADMIN_EMAIL, authEnabled } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Server wrapper: tells the app whether the signed-in user is the admin, who
// also sees the review sections. Without Supabase configured (local dev)
// everyone counts as admin.
export default async function Page() {
  let isAdmin = !authEnabled;
  if (authEnabled) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    isAdmin = !!data.user?.email && data.user.email.toLowerCase() === ADMIN_EMAIL;
  }
  return <Home isAdmin={isAdmin} />;
}
