import Home from "./Home";
import { canSeeVerified } from "@/lib/sections";
import { ADMIN_EMAIL, authEnabled } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

// Server wrapper: tells the client app whether the signed-in user may see the
// verified review sections (the admin and a short allowlist). Without Supabase
// configured (local dev) everyone sees them.
export default async function Page() {
  let showVerified = !authEnabled;
  if (authEnabled) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.toLowerCase();
    showVerified = canSeeVerified(email, !!email && email === ADMIN_EMAIL);
  }
  return <Home showVerified={showVerified} />;
}
