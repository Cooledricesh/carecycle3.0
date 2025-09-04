# 📱 모바일 UI 구현 Todo List

## 🎯 프로젝트 목표
정신과 병원 스케줄링 시스템의 모바일 UI 최적화 (온라인 전용, 기존 기능 유지)

## 📋 구현 원칙
- ✅ shadcn/ui와 Tailwind CSS 활용
- ✅ 기존 컴포넌트 최대한 재사용
- ✅ 표준 터치 인터랙션만 사용 (스와이프, 음성명령 제외)
- ✅ 온라인 전용 (오프라인 기능 불필요)

---

## 📝 Phase 1: 기본 인프라 구축

### 모바일 감지 훅 생성
- [x] `src/hooks/useIsMobile.ts` 생성
  - [x] 640px 미만 뷰포트 감지 로직
  - [x] SSR 호환성 처리
  - [x] 리사이즈 이벤트 처리

- [x] `src/hooks/useMobileLayout.ts` 생성
  - [x] 레이아웃 상태 관리
  - [x] 로컬 스토리지 선호도 저장
  - [x] 레이아웃 토글 기능

### 유틸리티 함수 추가
- [x] `src/lib/utils.ts` 모바일 헬퍼 추가
  - [x] 터치 타겟 사이즈 클래스 (최소 44px)
  - [x] 모바일 조건부 클래스 헬퍼
  - [x] 반응형 패딩/마진 유틸리티

---

## 📝 Phase 2: 네비게이션 시스템 개선

### Dashboard Navigation 수정
- [x] `src/components/dashboard/dashboard-nav.tsx`
  - [x] Sheet 컴포넌트 import
  - [x] 모바일에서 Sheet으로 변환
  - [x] 햄버거 메뉴 버튼 추가
  - [x] `lg:hidden` / `lg:block` 클래스 적용
  - [x] Sheet 열기/닫기 상태 관리

### Admin Navigation 수정
- [x] `src/components/admin/admin-nav.tsx`
  - [x] Dashboard nav와 동일한 패턴 적용
  - [x] Sheet 컴포넌트로 변환
  - [x] 모바일 메뉴 토글 구현

### 메인 레이아웃 조정
- [x] `src/app/(app)/layout.tsx`
  - [x] 모바일 패딩 조정
  - [x] 사이드바 조건부 렌더링
  - [x] 모바일 헤더 영역 확보

---

## 📝 Phase 3: 대시보드 반응형 처리

### 통계 카드 그리드
- [x] `src/app/(app)/dashboard/page.tsx`
  - [x] 데스크톱: `grid-cols-4`
  - [x] 태블릿: `sm:grid-cols-2`
  - [x] 모바일: `grid-cols-2` (2x2 레이아웃)
  - [x] 카드 간격 조정

### 오늘의 체크리스트 변환
- [x] 테이블 → 카드 변환 구현
  - [x] useIsMobile 훅 활용
  - [x] 모바일: Card 컴포넌트
  - [x] 데스크톱: 기존 Table 유지
  - [x] 카드 내 정보 우선순위 정리

### 통계 카드 최적화
- [x] `src/components/dashboard/stats-card.tsx` (없다면 인라인 수정)
  - [x] 모바일 폰트 크기 조정
  - [x] 아이콘 크기 반응형 처리
  - [x] 패딩 최적화

---

## 📝 Phase 4: 데이터 테이블 모바일 변환

### 환자 목록 페이지
- [x] `src/app/(app)/dashboard/patients/page.tsx`
  - [x] useIsMobile 훅 import
  - [x] 모바일 카드 레이아웃 구현
  - [x] 카드 디자인 (이름, 번호, 부서 표시)
  - [x] 액션 버튼 배치 (상세, 편집, 삭제)
  - [x] 검색 바 모바일 최적화

### 스케줄 목록 페이지
- [x] `src/app/(app)/dashboard/schedules/page.tsx`
  - [x] 테이블 → 카드 패턴 적용
  - [x] 중요 정보 상단 배치
  - [x] 날짜/시간 표시 최적화
  - [x] 상태 뱃지 크기 조정

### 프로필 페이지
- [x] `src/app/(app)/dashboard/profile/page.tsx`
  - [x] 폼 레이아웃 단일 컬럼화
  - [x] 버튼 전체 너비 적용

---

## 📝 Phase 5: 폼 & 모달 최적화

### 환자 등록 모달
- [ ] `src/components/patients/patient-registration-modal.tsx`
  - [ ] 모바일: 풀스크린 모달
  - [ ] DialogContent 클래스 조정
  - [ ] 폼 필드 세로 정렬
  - [ ] 버튼 그룹 모바일 최적화

### 스케줄 생성 모달
- [ ] `src/components/schedules/schedule-create-modal.tsx`
  - [ ] 풀스크린/바텀시트 스타일
  - [ ] 날짜 선택기 모바일 최적화
  - [ ] 드롭다운 터치 영역 확대

### 삭제 확인 다이얼로그
- [ ] `src/components/patients/patient-delete-dialog.tsx`
  - [ ] 모바일 중앙 정렬
  - [ ] 버튼 크기 증가
  - [ ] 텍스트 가독성 개선

---

## 📝 Phase 6: 컴포넌트 세부 조정

### 버튼 컴포넌트
- [ ] 모든 Button 컴포넌트
  - [ ] 최소 높이 44px 확인
  - [ ] 터치 영역 패딩 추가
  - [ ] 모바일에서 `size="default"` 사용

### 입력 필드
- [ ] 모든 Input 컴포넌트
  - [ ] 모바일 폰트 크기 16px (확대 방지)
  - [ ] 패딩 증가
  - [ ] 라벨 간격 조정

### 테이블 대체 컴포넌트
- [ ] 공통 모바일 카드 컴포넌트 생성 (선택)
  - [ ] 재사용 가능한 카드 레이아웃
  - [ ] props로 데이터 전달
  - [ ] 액션 슬롯 지원

---

## 📝 Phase 7: 성능 & 최종 점검

### 성능 최적화
- [ ] 불필요한 리렌더링 확인
- [ ] 모바일 번들 크기 체크
- [ ] 이미지 최적화 확인

### 반응형 테스트
- [ ] iPhone SE (375px) 테스트
- [ ] iPhone 14 (390px) 테스트
- [ ] Android (360px) 테스트
- [ ] iPad (768px) 테스트

### 접근성 확인
- [ ] 모든 터치 타겟 44px 이상
- [ ] 텍스트 가독성 확인
- [ ] 대비율 확인
- [ ] 포커스 상태 표시

### 기능 테스트
- [ ] 환자 등록 플로우
- [ ] 스케줄 생성 플로우
- [ ] 체크리스트 완료 처리
- [ ] 검색 기능
- [ ] 실시간 동기화 확인

---

## ✅ 완료 기준
- [ ] 모든 주요 페이지 모바일 최적화 완료
- [ ] 가로 스크롤 없음
- [ ] 터치 타겟 100% 준수
- [ ] 기존 기능 100% 작동
- [ ] 실시간 동기화 정상 작동

---

## 📌 참고사항
- 작업 완료 시 각 항목에 체크 표시
- 문제 발생 시 해당 항목 아래 코멘트 추가
- 추가 작업 필요 시 새 항목 추가

## 🚀 작업 시작일: 2025-01-04
## 🏁 작업 완료일: 

---

**작성일**: 2025-01-04
**프로젝트**: 정신과 병원 스케줄링 시스템 모바일 UI 최적화