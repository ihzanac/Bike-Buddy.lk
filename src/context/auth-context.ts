import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { UserProfile } from '@/types'

export type AuthState = {
  firebaseUser: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
