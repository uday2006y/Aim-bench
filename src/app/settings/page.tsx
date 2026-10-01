import { getSessionAccountId } from "@/lib/session";
import SettingsForm from "./SettingsForm";

/**
 * The bar-style preference lives in localStorage, so it can only be read in
 * the browser — but whether there is a session is server state. Splitting
 * the two keeps the header correct on first paint and means this page stops
 * making a request to find out something the server already knows.
 */
export default async function SettingsPage() {
  const accountId = await getSessionAccountId();

  return <SettingsForm loggedIn={Boolean(accountId)} />;
}
