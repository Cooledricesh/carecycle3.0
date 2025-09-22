import { FilterStrategy, UserContext } from './types'
import { DoctorFilterStrategy } from './DoctorFilterStrategy'
import { NurseFilterStrategy } from './NurseFilterStrategy'
import { AdminFilterStrategy } from './AdminFilterStrategy'

export class FilterStrategyFactory {
  private static strategies = new Map<string, FilterStrategy>()

  static create(userContext: UserContext): FilterStrategy {
    const key = `${userContext.role}-${userContext.userId}`

    // Return cached strategy if exists
    if (this.strategies.has(key)) {
      return this.strategies.get(key)!
    }

    // Create new strategy based on role
    let strategy: FilterStrategy

    switch (userContext.role) {
      case 'doctor':
        strategy = new DoctorFilterStrategy()
        break
      case 'nurse':
        strategy = new NurseFilterStrategy()
        break
      case 'admin':
        strategy = new AdminFilterStrategy()
        break
      default:
        throw new Error(`Unsupported role: ${userContext.role}`)
    }

    // Cache the strategy
    this.strategies.set(key, strategy)

    return strategy
  }

  static clearCache(): void {
    this.strategies.clear()
  }
}