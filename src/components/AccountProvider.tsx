"use client";

import { createContext, useContext } from "react";

export interface AccountInfo {
  name: string;
  avatar: string | null;
}

const AccountContext = createContext<AccountInfo | null>(null);

/** Hands the signed-in player's name and avatar to the sidebar, from the server. */
export default function AccountProvider({
  me,
  children,
}: {
  me: AccountInfo | null;
  children: React.ReactNode;
}) {
  return <AccountContext.Provider value={me}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountInfo | null {
  return useContext(AccountContext);
}
