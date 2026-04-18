"use client"

import { create } from "zustand"
import type { User, UserRole } from "@/types"
import { SEED_USERS } from "@/data/seed"

interface UserStore {
  currentUser: User
  users: User[]
  setRole: (role: UserRole) => void
  getUserById: (id: string) => User | undefined
}

export const useUserStore = create<UserStore>((set, get) => ({
  currentUser: SEED_USERS[0],
  users: SEED_USERS,

  setRole: (role) => {
    const match = SEED_USERS.find((u) => u.role === role)
    if (match) set({ currentUser: match })
  },

  getUserById: (id) => get().users.find((u) => u.id === id),
}))
