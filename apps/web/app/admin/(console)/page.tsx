import { redirect } from "next/navigation";
import { adminHomePath } from "@/lib/admin/adminSession";

export default function AdminHomePage() {
  redirect(adminHomePath);
}
