// 단위: 만원
const TAX_CREDITS = {
  // 1차년도 2025년 이전
  pre2025: {
    small: {
      metro:    { youth: 1450, nonYouth: 850 },
      nonMetro: { youth: 1550, nonYouth: 950 }
    },
    medium: { youth: 800, nonYouth: 450 },
    large:  { youth: 400, nonYouth: 0 }
  },
  // 1차년도 2025년 이후 — [1차, 2차, 3차]
  post2025: {
    small: {
      metro: {
        youth:    [700, 1600, 1700],
        nonYouth: [400,  900, 1000]
      },
      nonMetro: {
        youth:    [1000, 1900, 2000],
        nonYouth: [ 700, 1200, 1300]
      }
    },
    medium: {
      youth:    [500, 900, 900],
      nonYouth: [300, 500, 500]
    },
    large: {
      youth:    [300, 500, 0],
      nonYouth: [  0,   0, 0]
    }
  },
  // 정규직 전환 / 육아휴직 복귀 추가공제 (단위: 만원)
  regularConvert: { small: 1300, medium: 900 },
  parentalLeave:  { small: 1300, medium: 900 },

  // 지원 연수
  supportYears: {
    pre2025:  { small: 3, medium: 3, large: 2 },
    post2025: { small: 3, medium: 3, large: 2 }
  }
};
