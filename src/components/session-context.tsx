"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setCsrfToken } from "@/lib/client/api";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
};

type SessionState = {
  user: SessionUser;
  csrfToken: string;
  github: any;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({
  user,
  csrfToken,
  github,
  children,
}: {
  user: SessionUser;
  csrfToken: string;
  github: any;
  children: React.ReactNode;
}) {
  const [state, setState] = useState({ user, csrfToken, github });

  useEffect(() => {
    setCsrfToken(csrfToken);
  }, [csrfToken]);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: SessionUser; csrfToken: string; github: any }>("/api/auth/session");
      if (data.user) {
        setCsrfToken(data.csrfToken);
        setState({ user: data.user, csrfToken: data.csrfToken, github: data.github });
      }
    } catch {
      // keep the current session state
    }
  }, []);

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
