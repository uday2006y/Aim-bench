import { redirect } from "next/navigation";
import { getSessionAccountId } from "@/lib/session";
import CreateBenchmarkForm from "./CreateBenchmarkForm";

/**
 * Creating a benchmark needs an account: the row is written with the
 * caller's id as its owner.
 *
 * This gate is here rather than in the form because the alternative was a
 * visitor filling in a title, a rank ladder and forty scenario cutoffs only
 * to be told at the end that they needed to log in — the POST route answers
 * 401 and the work is lost. Reading the session on the server costs one
 * round trip we were already paying elsewhere on the page, and it means an
 * anonymous visitor is redirected before they type anything.
 */
export default async function CreateBenchmarkPage() {
  const accountId = await getSessionAccountId();

  if (!accountId) {
    redirect("/login");
  }

  return <CreateBenchmarkForm />;
}
