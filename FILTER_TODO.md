# 역할 기반 스마트 필터 구현 TODO

## 📋 개요
사용자의 role(doctor/nurse/admin)에 따라 자동으로 기본 필터를 적용하고, 간단한 토글로 전체 보기를 제공하는 최소 구현

## 🎯 목표
- **주치의(doctor)**: 기본적으로 본인 환자만 표시 → 전체 보기 토글 제공
- **간호사(nurse)**: 기본적으로 소속 진료구분만 표시 → 전체 보기 토글 제공
- **관리자(admin)**: 모든 데이터 표시, 기존 필터 사용 가능

---

## ✅ 구현 체크리스트

### Phase 1: 데이터 모델 확장 (15분)

#### 1.1 필터 타입 수정
- [ ] `/lib/filters/filter-types.ts` 수정
  - [ ] `showAll: boolean` 필드 추가
  - [ ] `viewMode: 'my' | 'all'` enum 추가 (선택적)
  - [ ] 타입 설명 주석 추가

#### 1.2 데이터베이스 준비 (향후)
- [ ] patients 테이블에 `doctor_id` 컬럼 추가 마이그레이션 작성
- [ ] 기존 데이터에 대한 doctor_id 매핑 (수동 또는 스크립트)

---

### Phase 2: 비즈니스 로직 구현 (30분)

#### 2.1 FilterProvider 개선
- [ ] `/providers/filter-provider.tsx` 수정
  - [ ] useProfile() 훅 import
  - [ ] `getInitialFilters(user, profile)` 함수 구현
    - [ ] doctor role: 본인 환자 필터 설정
    - [ ] nurse role: 소속 department 필터 설정
    - [ ] admin role: 필터 없음
  - [ ] `toggleShowAll()` 함수 추가
  - [ ] Context value에 새 함수 추가

#### 2.2 Service Layer 수정
- [ ] `/services/scheduleService.ts` 수정
  - [ ] getAllSchedules()에 showAll 로직 추가
  - [ ] getTodayChecklist()에 showAll 로직 추가
  - [ ] getUpcomingSchedules()에 showAll 로직 추가
  - [ ] showAll=true일 때 필터 우회 로직

---

### Phase 3: UI 컴포넌트 구현 (30분)

#### 3.1 Simple Filter Toggle 컴포넌트
- [ ] `/components/filters/SimpleFilterToggle.tsx` 생성
  - [ ] useProfile() 훅으로 사용자 정보 가져오기
  - [ ] role별 다른 UI 렌더링
    - [ ] doctor: "내 환자" / "전체 환자" 토글
    - [ ] nurse: "{department} 환자" / "전체 환자" 토글
    - [ ] admin: null 반환 (기존 필터 사용)
  - [ ] 모바일 반응형 디자인

#### 3.2 FilterBar 수정
- [ ] `/components/filters/FilterBar.tsx` 수정
  - [ ] useProfile() 훅 import
  - [ ] role 체크 로직 추가
  - [ ] admin이 아닌 경우 SimpleFilterToggle 표시
  - [ ] admin인 경우 기존 CareTypeFilter 표시
  - [ ] 필터 요약 텍스트 개선

#### 3.3 Filter Summary 컴포넌트 (선택)
- [ ] `/components/filters/FilterSummary.tsx` 생성
  - [ ] 현재 필터 상태 텍스트로 표시
  - [ ] 예: "외래 환자 12명 표시 중"

---

### Phase 4: 통합 및 테스트 (30분)

#### 4.1 페이지 통합
- [ ] `/app/(protected)/dashboard/page.tsx` 검증
  - [ ] FilterProvider가 profile 정보 전달하는지 확인
  - [ ] 필터 변경 시 데이터 업데이트 확인

- [ ] `/app/(protected)/dashboard/calendar/page.tsx` 검증
  - [ ] 캘린더 뷰에서 필터 적용 확인

#### 4.2 테스트 시나리오
- [ ] **Doctor 계정 테스트**
  - [ ] 로그인 시 기본적으로 본인 환자만 표시
  - [ ] "전체 환자" 토글 시 모든 환자 표시
  - [ ] URL 파라미터 동기화 확인

- [ ] **Nurse 계정 테스트**
  - [ ] 로그인 시 소속 부서 환자만 표시
  - [ ] "전체 환자" 토글 시 모든 환자 표시
  - [ ] 부서 정보 없는 간호사 처리

- [ ] **Admin 계정 테스트**
  - [ ] 기존 필터 정상 작동
  - [ ] 진료구분 필터 정상 작동

#### 4.3 엣지 케이스
- [ ] department가 null인 nurse 처리
- [ ] 환자 데이터가 없는 경우 UI
- [ ] 필터 전환 시 로딩 상태
- [ ] 에러 핸들링

---

### Phase 5: 최적화 및 문서화 (15분)

#### 5.1 성능 최적화
- [ ] 불필요한 리렌더링 방지
- [ ] React Query 캐시 키 최적화
- [ ] 필터 디바운싱 (필요시)

#### 5.2 문서 업데이트
- [ ] README.md에 필터 시스템 설명 추가
- [ ] CLAUDE.md에 필터 관련 가이드라인 추가
- [ ] 코드 주석 추가

---

## 🔮 향후 개선 사항

### 단기 (1-2주)
- [ ] 주치의 필드 실제 구현 (DB 마이그레이션)
- [ ] 필터 프리셋 저장 기능
- [ ] 필터 히스토리 기능

### 중기 (1개월)
- [ ] 고급 필터 옵션 (날짜, 상태 등)
- [ ] 필터 조합 저장 및 공유
- [ ] 부서간 협업 필터

### 장기 (3개월)
- [ ] AI 기반 스마트 필터 추천
- [ ] 필터 사용 패턴 분석
- [ ] 개인화된 대시보드 뷰

---

## 📝 참고 사항

### 현재 구조
```
role: 'doctor' | 'nurse' | 'admin'
department: '외래' | '입원' | '낮병원' | null
```

### 예상 작업 시간
- 총 소요 시간: 약 2시간
- 최소 구현: 1시간
- 테스트 및 디버깅: 30분
- 문서화: 30분

### 주의 사항
- 오버엔지니어링 방지 - 최소 기능부터 구현
- 기존 코드와의 호환성 유지
- 점진적 개선 가능한 구조 유지

---

## 🚀 실행 명령어

```bash
# 개발 서버 실행
npm run dev

# 타입 체크
npm run type-check

# 린트
npm run lint

# 빌드 테스트
npm run build
```

---

*마지막 업데이트: 2025-01-20*