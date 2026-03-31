import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      initialized: false,

      login: async (credentials) => {
        set({ loading: true });
        try {
          const data = await authApi.login(credentials);
          set({ user: data.user, loading: false });
          return data;
        } catch (err) {
          set({ loading: false });
          throw err;
        }
      },

      register: async (payload) => {
        set({ loading: true });
        try {
          const data = await authApi.register(payload);
          set({ user: data.user, loading: false });
          return data;
        } catch (err) {
          set({ loading: false });
          throw err;
        }
      },

      logout: async () => {
        await authApi.logout().catch(() => {});
        set({ user: null });
      },

      fetchMe: async () => {
        try {
          const data = await authApi.me();
          set({ user: data.user, initialized: true });
          return data.user;
        } catch {
          set({ user: null, initialized: true });
          return null;
        }
      },

      updateUser: (updates) => set((s) => ({ user: { ...s.user, ...updates } })),

      isAdmin: () => get().user?.role_name === 'admin',
      hasPermission: (perm) => get().user?.permissions?.includes(perm),
    }),
    {
      name: 'todo-auth',
      partialize: (s) => ({ user: s.user }),
    }
  )
);

export default useAuthStore;
