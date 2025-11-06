### **[프롬프트 시작]**

**# 페르소나 (Persona)**
당신은 Next.js와 테스트 자동화에 능숙한 시니어 스태프 소프트웨어 엔지니어(Senior Staff Software Engineer)입니다.

**# 목표 (Objective)**
현재 프로젝트의 단위 테스트 환경을 **Jest에서 Vitest로 전환**하고, 기존 테스트 코드가 정상적으로 동작하는 것을 검증하는 것이 당신의 핵심 임무입니다. 속도와 개발자 경험을 최우선으로 고려합니다.

**# 최종 기술 스택 (Final Tech Stack)**
*   **Test Runner**: **Vitest**
*   **Test Environment**: **JSDOM**
*   **Testing Library**: **@testing-library/react**
*   **언어**: **TypeScript**

**# 실행 계획 (Action Plan)**
아래 지침을 순서대로 정확히 이행하여 테스트 환경 전환을 완료하세요.

**1. 의존성 재구성 (Reconfigure Dependencies)**
    *   기존 Jest 관련 패키지를 모두 제거합니다. (`jest`, `jest-environment-jsdom`, `ts-jest`, `@types/jest` 등)
    *   Vitest와 필수 플러그인을 개발 의존성(devDependencies)으로 설치합니다.
        *   `npm install -D vitest @vitejs/plugin-react @testing-library/react`

**2. 설정 파일 생성 및 수정 (Configure Files)**
    *   **`vitest.config.ts` 파일 생성:** 프로젝트 루트 경로에 아래 내용으로 `vitest.config.ts` 파일을 생성합니다.
        ```typescript
        /// <reference types="vitest" />
        import { defineConfig } from 'vitest/config';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
          plugins: [react()],
          test: {
            globals: true,
            environment: 'jsdom',
            setupFiles: './jest.setup.js', // 기존 setup 파일 재활용
            css: true,
          },
        });
        ```

    *   **`tsconfig.json` 파일 수정:** `compilerOptions`의 `types` 배열에 `"vitest/globals"`를 추가하여 Vitest의 전역 API 타입을 인식하도록 합니다.
        ```json
        {
          "compilerOptions": {
            // ... 기존 옵션들
            "types": ["node", "vitest/globals"]
          },
          // ...
        }
        ```

    *   **`package.json` 파일 수정:** `scripts`의 `"test"` 명령어를 `"vitest"`로 변경합니다.
        ```json
        {
          "scripts": {
            "test": "vitest"
          }
        }
        ```

**3. 테스트 코드 호환성 검증 (Verify Test Code Compatibility)**
    *   `src/lib/utils/date.test.ts` 파일의 내용은 Jest와 Vitest가 호환되므로 **수정할 필요가 없습니다.**
    *   아래는 검증 대상 테스트 코드입니다.
        ```typescript
        // src/lib/utils/date.test.ts
        import { safeFormatDate } from './date';

        describe('safeFormatDate', () => {
          test('should format a valid date string correctly', () => {
            // ... (기존 테스트 케이스 5개)
          });
          // ...
        });
        ```

**4. 최종 검증 (Final Verification)**
    *   터미널에서 `npm test` 명령어를 실행합니다.
    *   `safeFormatDate.test.ts` 파일의 **5개 테스트 케이스가 모두 통과(PASS)**하는지 확인합니다. 이 결과가 나오면 임무가 완료된 것입니다.

**# 완료 조건 (Definition of Done)**
*   `npm test` 실행 시 Vitest가 구동되고 `safeFormatDate.test.ts`의 모든 테스트가 성공적으로 통과합니다.
*   Jest 관련 의존성은 `package.json`에서 제거되고, Vitest 관련 의존성이 추가됩니다.
*   `vitest.config.ts` 파일이 프로젝트 루트에 생성되어 있습니다.

### **[프롬프트 끝]**