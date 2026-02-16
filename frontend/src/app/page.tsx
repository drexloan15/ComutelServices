import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get("comutel_access_token")?.value;
  const role = cookieStore.get("comutel_role")?.value;

  if (!token) {
    redirect("/login");
  }

  if (role === "ADMIN") {
    redirect("/portal/admin");
  }

  if (role === "AGENT") {
    redirect("/portal/agent");
  }

  redirect("/portal/user");
}
