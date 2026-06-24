/**
 * Identity hook (DEC-024). Wraps the auth token + `/api/me` so screens can read the current user,
 * ensure one exists (creates an anonymous account on first sight), and edit the profile. The last
 * profile is cached locally so the squad UI renders the name/colour offline.
 */
import { useCallback, useEffect, useState } from "react";
import { api, type ProfileInput } from "./api";
import { AUTH_EVENT, cacheUser, cachedUser } from "./authToken";
import type { UserDto } from "./types";

export interface Identity {
  user: UserDto | null;
  /** A profile exists once the user has set a display name (the gate for joining a squad). */
  hasProfile: boolean;
  loading: boolean;
  error: boolean;
  /** Ensure a server user exists; returns it (anonymous on first call). */
  ensure: () => Promise<UserDto | null>;
  /** Persist a profile edit and refresh the cached user. */
  updateProfile: (profile: ProfileInput) => Promise<UserDto | null>;
  /** Upload an avatar photo to R2 (DEC-059); refreshes the cached user. Throws the server's reason. */
  uploadAvatar: (blob: Blob) => Promise<UserDto>;
  /** Remove the avatar photo (revert to the colour initial); refreshes the cached user. */
  removeAvatar: () => Promise<UserDto | null>;
}

export function useIdentity(): Identity {
  const [user, setUser] = useState<UserDto | null>(cachedUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const sync = (): void => setUser(cachedUser());
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const ensure = useCallback(async (): Promise<UserDto | null> => {
    setLoading(true);
    setError(false);
    try {
      const fetched = await api.getMe();
      cacheUser(fetched);
      setUser(fetched);
      return fetched;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (profile: ProfileInput): Promise<UserDto | null> => {
    setLoading(true);
    setError(false);
    try {
      const saved = await api.updateMe(profile);
      cacheUser(saved);
      setUser(saved);
      return saved;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Avatar upload rethrows so the screen can show the server's honest reject reason (DEC-059).
  const uploadAvatar = useCallback(async (blob: Blob): Promise<UserDto> => {
    setLoading(true);
    setError(false);
    try {
      const saved = await api.uploadAvatar(blob);
      cacheUser(saved);
      setUser(saved);
      return saved;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeAvatar = useCallback(async (): Promise<UserDto | null> => {
    setLoading(true);
    setError(false);
    try {
      const saved = await api.removeAvatar();
      cacheUser(saved);
      setUser(saved);
      return saved;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    user,
    hasProfile: Boolean(user?.displayName),
    loading,
    error,
    ensure,
    updateProfile,
    uploadAvatar,
    removeAvatar,
  };
}

/** Initials for an avatar from a display name (e.g. "Julio Corcini" -> "JC"). */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** The amber-glass dot-colour palette offered at profile setup (matches wireframe #23.3). */
export const DOT_COLORS = ["#F5A623", "#0EA5E9", "#16A34A", "#EC4899", "#7C3AED"] as const;
