# TDD Process Guidelines

## ⚠️ MANDATORY: Follow these rules for EVERY implementation and modification

**This document defines the REQUIRED process for all code changes. No exceptions without explicit team approval.**

## Core Cycle: Red → Green → Refactor

### 1. RED Phase
- Write a failing test FIRST
- Test the simplest scenario
- Verify test fails for the right reason
- One test at a time

### 2. GREEN Phase  
- Write MINIMAL code to pass
- "Fake it till you make it" is OK
- No premature optimization
- YAGNI principle

### 3. REFACTOR Phase
- Remove duplication
- Improve naming
- Simplify structure
- Keep tests passing

## Test Quality: FIRST Principles
- **Fast**: Milliseconds, not seconds
- **Independent**: No shared state
- **Repeatable**: Same result every time
- **Self-validating**: Pass/fail, no manual checks
- **Timely**: Written just before code

## Test Structure: AAA Pattern
```
// Arrange
Set up test data and dependencies

// Act
Execute the function/method

// Assert
Verify expected outcome
```

## Implementation Flow
1. **List scenarios** before coding
2. **Pick one scenario** → Write test
3. **Run test** → See it fail (Red)
4. **Implement** → Make it pass (Green)
5. **Refactor** → Clean up (Still Green)
6. **Commit** → Small, frequent commits
7. **Repeat** → Next scenario

## Test Pyramid Strategy
- **Unit Tests** (70%): Fast, isolated, numerous
- **Integration Tests** (20%): Module boundaries
- **Acceptance Tests** (10%): User scenarios

## Outside-In vs Inside-Out
- **Outside-In**: Start with user-facing test → Mock internals → Implement details
- **Inside-Out**: Start with core logic → Build outward → Integrate components

## Common Anti-patterns to Avoid
- Testing implementation details
- Fragile tests tied to internals  
- Missing assertions
- Slow, environment-dependent tests
- Ignored failing tests

## When Tests Fail
1. **Identify**: Regression, flaky test, or spec change?
2. **Isolate**: Narrow down the cause
3. **Fix**: Code bug or test bug
4. **Learn**: Add missing test cases

## Team Practices
- CI/CD integration mandatory
- No merge without tests
- Test code = Production code quality
- Pair programming for complex tests
- Regular test refactoring

## Pragmatic Exceptions
- UI/Graphics: Manual + snapshot tests
- Performance: Benchmark suites
- Exploratory: Spike then test
- Legacy: Test on change

## Vooster Project-Specific Guidelines ⚠️ CRITICAL

### Testing Strategy for Medical Scheduling System

**Project Scale**: ~35K LOC
**Target Tests**: ~250 high-quality tests (NOT 500+)

#### Test Distribution:
```
목표: 250개 고품질 테스트

Unit Tests (70%): ~175개
├── 복잡한 비즈니스 로직 (스케줄 계산, 검증)
├── 자명한 래퍼 함수 제외
└── 순수 함수 중심

Integration Tests (20%): ~50개
├── 실제 Supabase 연동 (mock 아님)
├── RLS 정책 검증
└── Multi-tenancy 격리

E2E Tests (10%): ~25개
├── 환자 워크플로우
├── 스케줄 생성 → 실행
└── 보안 시나리오
```

#### What NOT to Test in This Project:

**❌ 생략해야 할 것들:**

```typescript
// ❌ Don't test date-fns wrappers
export const addWeeks = (d, w) => addDays(d, w * 7)
// 이유: 단순 곱셈, 자명함

// ❌ Don't test Supabase SDK behavior
await supabase.from('patients').select('*')
// 이유: Supabase 라이브러리 동작 테스트

// ❌ Don't test Next.js routing
router.push('/dashboard')
// 이유: 프레임워크 동작

// ❌ Don't mock Supabase for "integration" tests
// 이유: Mock이 코드보다 길면 가치 없음
// ✅ 대신: 테스트 Supabase 인스턴스 사용
```

#### Medical Software Risk Areas (Test These Heavily):

**🔴 Critical** (철저히 테스트):
- 스케줄 계산 (잘못된 날짜 = 환자 피해)
- 환자 식별 (잘못된 환자 = 치명적 오류)
- Multi-tenancy 격리 (데이터 유출 = 법적 문제)

**🟡 Important** (선택적 테스트):
- 폼 검증
- UI 컴포넌트 상태
- API 에러 처리

**🟢 Low Priority** (최소 테스트):
- 유틸리티 함수
- 스타일링 로직
- 설정

### Test-to-Code Ratio Guidelines

| Code Type | Ratio | Example |
|-----------|-------|---------|
| 복잡한 비즈니스 로직 | 1.5:1 | Schedule calculations |
| 표준 서비스 | 1:1 | Patient CRUD |
| 단순 유틸리티 | 0.5:1 | Formatters |
| 자명한 래퍼 | 0:1 | addWeeks (skip) |

### Test Value Assessment

**테스트 작성 전 가치 평가:**

```
Test Value = (Bug Prevention Impact) / (Maintenance Cost)

Bug Prevention Impact:
- High: 환자 안전, 보안, 데이터 무결성
- Medium: 사용자 경험, 데이터 정확성
- Low: 편의 기능, 스타일링

Maintenance Cost:
- High: Mock 기반 테스트, 구현 종속적
- Medium: Integration 테스트, Component 테스트
- Low: 순수 함수 테스트, Behavior 테스트

If Value < 1, skip the test.
```

### Examples of Good Test Judgment:

```typescript
// ✅ DO TEST: 복잡한 로직
function addMonths(date: Date, months: number): Date {
  // Month-end overflow 처리
  if (result.getDate() !== targetDate) {
    result.setDate(0)
  }
  return result
}
// 이유: 윤년, 월말 날짜 엣지 케이스

// ❌ DON'T TEST: 자명한 래퍼
const addWeeks = (d, w) => addDays(d, w * 7)
// 이유: 단순 곱셈

// ✅ DO TEST: 보안 중요
validatePatientAccess(userId, patientId)
// 이유: 데이터 유출 = 치명적

// ❌ DON'T TEST: 타입 보장
interface Patient { patient_name: string }
// 이유: TypeScript가 이미 체크
```

### Pattern Duplication Prevention

**🚨 같은 테스트 패턴이 3번 이상 반복되면 통합하세요:**

```typescript
// ❌ BAD: 6개 파일에 동일 패턴
cross-organization-access.test.ts (21 tests)
organization-specific-access.test.ts (22 tests)
// ... 4 more files

// ✅ GOOD: 공통 유틸리티로 추출
function testCrossOrgAccess(table: string) {
  describe(`${table} isolation`, () => {
    it('should block cross-org access', ...)
  })
}

testCrossOrgAccess('patients')
testCrossOrgAccess('schedules')
// 결과: 118 tests → 40 tests
```

### Key Mindset Shift

**Before (Wrong Approach)**:
- "모든 것을 테스트" → 506 tests
- Mock 기반 "통합" 테스트
- 자명한 함수까지 테스트
- 테스트 개수 = 품질

**After (Right Approach)**:
- "가치 있는 것만 테스트" → 250 tests
- 실제 DB 통합 테스트
- 복잡한 로직만 테스트
- 테스트 품질 = 신뢰도

## Remember
- Tests are living documentation
- Test behavior, not implementation
- Small steps, fast feedback
- **Quality over quantity** - 250 good tests > 500 mediocre tests
- When in doubt, **assess value first**, then decide

**Further Reading**: See `/docs/testing/testing-guidelines.md` for comprehensive guide