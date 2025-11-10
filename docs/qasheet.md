## QA Checklist

### `/dashboard`
- [x] 환자 카드에 예정일: 날짜 없음, 주치의: 미지정, 소속: 미지정 으로 데이터 읽어오기 실패
- [x] 연체중인 환자 표시 칼럼 사라짐

### `/dashboard/calendar`
- [x] 일정 조회 실패. 아무 데이터도 조회하지 못함.

### `/dashboard/patients`
- [x] 진료 구분 조회 실패. 모두 미지정
- [x] '박승현' 주치의 표시 실패. 아이디 값'c99b28ec...'를 불러오고 있음

### `/dashboard/schedules`
- [x] 일정 조회 실패. '스케줄을 불러오는 중 오류가 발생했습니다.'

### `/admin`
- [ ] departments CRUD 페이지로 가는 navigation 없음
- [ ] 정책 설정 기능 ui 표시 안됨

### `/auth/signup`
- [ ] 기관 생성 또는 기존 등록 기관 선택 ui 표시 안됨

### `/dashboard/items`
- [ ] 주사제에 대해 용량 설정란 표시 기능 작동 안함.


