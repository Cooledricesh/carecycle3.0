# 🚨 긴급 보안 조치 가이드

## 현재 상황
- Service Role Key가 Git 히스토리에 노출됨
- Supabase Dashboard에서 직접 재생성 불가

## 즉시 실행할 보안 조치

### 1. RLS (Row Level Security) 강화 ⚡
모든 테이블의 RLS가 활성화되어 있는지 확인:

```sql
-- Supabase SQL Editor에서 실행
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### 2. 임시 Service Role Key 사용 중단
`.env` 파일에서 Service Role Key 제거하고 anon key만 사용:

```env
# SUPABASE_SERVICE_ROLE_KEY=제거됨_보안상_이유
```

### 3. Edge Functions로 민감한 작업 이동
Service Role Key가 필요한 작업을 Edge Functions로 이동:

```typescript
// supabase/functions/admin-actions/index.ts
import { createClient } from '@supabase/supabase-js'
import { serve } from 'std/server'

serve(async (req) => {
  // Edge Function 내에서는 service role key 사용 가능
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  // 관리자 작업 수행
})
```

### 4. API Key 권한 제한
Supabase Dashboard → Authentication → Policies에서:
- 모든 테이블에 strict RLS policies 적용
- Public access 최소화

### 5. 감사 로그 모니터링
```sql
-- 최근 의심스러운 활동 확인
SELECT * FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### 6. 긴급 연락처
- Supabase Support: support@supabase.io
- Supabase Discord: https://discord.supabase.com
- Twitter: @supabase (긴급 시 DM)

## 임시 해결책: 새 프로젝트 마이그레이션

최악의 경우, 새 Supabase 프로젝트로 마이그레이션:

1. 새 프로젝트 생성
2. 스키마 내보내기: `pg_dump --schema-only`
3. 데이터 마이그레이션: `pg_dump --data-only`
4. 새 API keys로 앱 업데이트

## 향후 예방 조치

1. **GitHub Secrets 사용**
   ```yaml
   # .github/workflows/deploy.yml
   env:
     SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
   ```

2. **환경 변수 검증 스크립트**
   ```bash
   # check-secrets.sh
   grep -r "eyJ" --include="*.js" --include="*.ts" --exclude-dir=node_modules
   ```

3. **Pre-commit Hook 설치**
   ```bash
   npm install -D husky
   npx husky add .husky/pre-commit "grep -r 'eyJ' --include='*.js' --include='*.ts' && exit 1 || exit 0"
   ```

## 체크리스트

- [ ] Supabase Support 연락
- [ ] RLS 정책 확인 및 강화
- [ ] 의심스러운 활동 로그 확인
- [ ] Git 히스토리 정리
- [ ] 팀원들에게 상황 공유
- [ ] 보안 감사 실시