import { departments } from '../data/departments'
import type { DepartmentKey, UserRole } from '../types/domain'
import { usePersistentState } from './usePersistentState'

export type DemoUser = {
  id: string
  name: string
  role: UserRole
  departmentKey: DepartmentKey | null
  title: string
}

export const demoUsers: DemoUser[] = [
  { id: 'hotel-manager', name: 'Hannah Smith', role: 'Hotel manager', departmentKey: null, title: 'Hotel manager · all areas' },
  ...departments.map((department) => ({
    id: department.key,
    name: department.manager,
    role: 'Department manager' as const,
    departmentKey: department.key,
    title: `${department.name} manager`,
  })),
]

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function useCurrentUser() {
  const [userId, setUserId] = usePersistentState<string>('otel:current-user', 'hotel-manager')
  const user = demoUsers.find((item) => item.id === userId) ?? demoUsers[0]
  const isHotelManager = user.role === 'Hotel manager'
  const allowedAreas: DepartmentKey[] = isHotelManager ? departments.map((department) => department.key) : [user.departmentKey as DepartmentKey]
  const areaName = isHotelManager ? null : departments.find((department) => department.key === user.departmentKey)?.name ?? null

  return {
    user,
    role: user.role,
    isHotelManager,
    allowedAreas,
    areaName,
    canAccess: (key: DepartmentKey | 'all' | null | undefined) => isHotelManager || key === user.departmentKey,
    setUserId,
  }
}
