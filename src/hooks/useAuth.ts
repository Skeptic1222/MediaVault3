import { useQuery } from "@tanstack/react-query";

interface AuthResponse {
  authenticated: boolean;
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  profileImageUrl?: string;
  initials?: string;
}

export function useAuth() {
  const { data, isLoading } = useQuery<AuthResponse>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const basePath = import.meta.env.BASE_URL || '/mediavault/';
      const res = await fetch(`${basePath}api/user`, { credentials: 'include' });
      return res.json();
    },
    retry: false,
  });

  return {
    user: data?.authenticated ? data : null,
    isLoading,
    isAuthenticated: data?.authenticated === true,
  };
}
