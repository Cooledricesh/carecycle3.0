import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 모바일 환경에 따른 조건부 클래스 적용
 */
export function mobileClass(
  isMobile: boolean,
  mobileClasses: string,
  desktopClasses: string = ""
): string {
  return isMobile ? mobileClasses : desktopClasses;
}

/**
 * 터치 타겟 최소 크기 보장 (44px)
 * 모바일 접근성을 위한 유틸리티
 */
export const touchTarget = {
  // 버튼 및 클릭 가능한 요소
  button: "min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]",
  
  // 입력 필드
  input: "h-11 sm:h-10 px-4 text-base sm:text-sm",
  
  // 링크 및 네비게이션 아이템
  link: "min-h-[44px] px-3 sm:min-h-[36px]",
  
  // 체크박스, 라디오 버튼
  checkbox: "h-5 w-5 sm:h-4 sm:w-4",
  
  // 아이콘 버튼
  iconButton: "h-11 w-11 sm:h-9 sm:w-9"
};

/**
 * 반응형 패딩 유틸리티
 */
export const responsivePadding = {
  // 페이지 레벨 패딩
  page: "px-4 sm:px-6 lg:px-8",
  
  // 섹션 패딩
  section: "py-6 sm:py-8 lg:py-12",
  
  // 카드 패딩
  card: "p-4 sm:p-6",
  
  // 컴팩트 패딩
  compact: "p-2 sm:p-3",
  
  // 모달 패딩
  modal: "p-4 sm:p-6 lg:p-8"
};

/**
 * 반응형 간격 유틸리티
 */
export const responsiveSpacing = {
  // 요소 간 간격
  gap: {
    xs: "gap-2 sm:gap-3",
    sm: "gap-3 sm:gap-4",
    md: "gap-4 sm:gap-6",
    lg: "gap-6 sm:gap-8",
    xl: "gap-8 sm:gap-12"
  },
  
  // 마진
  margin: {
    xs: "m-2 sm:m-3",
    sm: "m-3 sm:m-4",
    md: "m-4 sm:m-6",
    lg: "m-6 sm:m-8",
    xl: "m-8 sm:m-12"
  }
};

/**
 * 반응형 텍스트 크기
 */
export const responsiveText = {
  // 제목
  h1: "text-2xl sm:text-3xl lg:text-4xl font-bold",
  h2: "text-xl sm:text-2xl lg:text-3xl font-semibold",
  h3: "text-lg sm:text-xl lg:text-2xl font-semibold",
  h4: "text-base sm:text-lg lg:text-xl font-medium",
  
  // 본문
  body: "text-base sm:text-sm",
  small: "text-sm sm:text-xs",
  
  // 버튼 텍스트
  button: "text-base sm:text-sm font-medium"
};

/**
 * 모바일에서 풀스크린 모달을 위한 클래스
 */
export const mobileFullScreen = 
  "fixed inset-0 sm:relative sm:inset-auto sm:max-w-lg sm:mx-auto";

/**
 * 그리드 반응형 클래스
 */
export const responsiveGrid = {
  // 2열 그리드 (모바일: 1열)
  cols2: "grid grid-cols-1 sm:grid-cols-2",
  
  // 3열 그리드 (모바일: 1열, 태블릿: 2열)
  cols3: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  
  // 4열 그리드 (모바일: 2열, 태블릿: 2열)
  cols4: "grid grid-cols-2 lg:grid-cols-4",
  
  // 카드 그리드 (모바일 최적화)
  cards: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
};

/**
 * Item category mapping utilities
 */
export const categoryMapping = {
  // Korean to English mapping
  koreanToEnglish: {
    '주사': 'injection',
    '검사': 'test',
    '기타': 'other'
  } as const,

  // English to Korean mapping (for display purposes)
  englishToKorean: {
    'injection': '주사',
    'test': '검사',
    'other': '기타'
  } as const
};

/**
 * Convert Korean category to English
 */
export function mapKoreanCategoryToEnglish(koreanCategory: string): string {
  return categoryMapping.koreanToEnglish[koreanCategory as keyof typeof categoryMapping.koreanToEnglish] || koreanCategory;
}

/**
 * Convert English category to Korean (for display)
 */
export function mapEnglishCategoryToKorean(englishCategory: string): string {
  return categoryMapping.englishToKorean[englishCategory as keyof typeof categoryMapping.englishToKorean] || englishCategory;
}
