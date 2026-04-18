"use client"

import { create } from "zustand"
import type { Wallet, WalletStatus } from "@/types"
import { SEED_WALLETS } from "@/data/seed"

interface WalletStore {
  wallets: Wallet[]
  getWalletById: (id: string) => Wallet | undefined
  updateBalance: (walletId: string, amount: number) => void
  setWalletStatus: (walletId: string, status: WalletStatus) => void
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  wallets: SEED_WALLETS,

  getWalletById: (id) => get().wallets.find((w) => w.id === id),

  updateBalance: (walletId, amount) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === walletId ? { ...w, balance: w.balance - amount } : w
      ),
    })),

  setWalletStatus: (walletId, status) =>
    set((state) => ({
      wallets: state.wallets.map((w) =>
        w.id === walletId ? { ...w, status } : w
      ),
    })),
}))
