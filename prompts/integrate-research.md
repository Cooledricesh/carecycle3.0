## 연동 가이드 초안 작성

clerk, gemini, tosspayments 서비스에 대해 다음과 같이 연동 가이드를 조사하라.

1. integrate-researcher 에이전트를 사용해 각 서비스의 연동가이드를 /docs/external/{service-name}.md 경로에 작성한다. 이들은 모두 병렬로 실행된다.
2. integrate-critic 에이전트를 사용해 각 서비스의 연동가이드를 검증하고, 오류가 있는 내용을 수정해 /docs/external/{service-name}.md 경로에 새로 작성한다. 이들은 모두 병렬로 실행된다.
