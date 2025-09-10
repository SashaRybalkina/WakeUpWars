import React, { createContext, useState, useContext } from "react";

export type SkillLevel = {
  category: { categoryName: string };
  totalEarned: number;
  totalPossible: number;
};

type User = { id: string | number; name: string; email: string; username: string } | null;

type UserCtx = {
  user: User;
  setUser: (u: User) => void;
  csrfToken: string | null;
  setCsrfToken: (t: string | null) => void;
  skillLevels: SkillLevel[];
  setSkillLevels: (l: SkillLevel[]) => void;
};

const UserContext = createContext<UserCtx | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [skillLevels, setSkillLevels] = useState<SkillLevel[]>([]);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        csrfToken,
        setCsrfToken,
        skillLevels,
        setSkillLevels,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within <UserProvider>");
  return ctx;
};
