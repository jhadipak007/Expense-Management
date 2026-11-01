import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/** Session state and actions: { status, user, login, completeRegistration, logout, updateUser }. */
export function useAuth() {
  return useContext(AuthContext);
}
