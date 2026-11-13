import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "../api/client";

export const sessionQueryKey = ["session"] as const;

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 30_000,
  });
}
