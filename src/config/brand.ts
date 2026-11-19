export const BRAND = {
  nameAr: 'وجاهة',
  nameEn: 'WIJAHA',
  taglineEn: 'WIJAHA — From Search to Experience',
  promiseAr: 'اكتب مناسبتك، ونجهّز لك الباقي',
  promiseEn: 'Describe your occasion, and we prepare the rest',
  fiveVerbsAr: ['ابحث', 'افهم', 'استعد', 'تدرّب', 'نفّذ'],
  fiveVerbsEn: ['Search', 'Understand', 'Prepare', 'Practice', 'Execute'],
  trademarkStatusNoticeAr: 'اسم مبدئي — قيد مراجعة العلامة التجارية',
  trademarkStatusNoticeEn: 'Provisional brand name — subject to trademark review',
  assets: {
    protocolSalon: '/assets/images/protocol_reception_editorial_1795048913215.jpg',
    vipDining: '/assets/images/vip_dining_protocol_1795048914726.jpg',
  },
  tokens: {
    light: {
      bg: '#FAF7F0',
      surface: '#FFFFFF',
      surface2: '#F3EEE3',
      ink: '#14213D',
      ink2: '#3D4A63',
      ink3: '#596275', // Verified >= 5.4:1 contrast on #FAF7F0
      line: '#E4DCCB',
      gold: '#B08D57',
      goldInk: '#755627', // Verified >= 5.2:1 contrast on #FAF7F0
      primary: '#14213D',
      success: '#2F6B4F',
      warning: '#7D5100',
      danger: '#9B2C2C',
    },
    dark: {
      bg: '#0E1424',
      surface: '#151C2F',
      surface2: '#1C2440',
      ink: '#F3EEE3',
      ink2: '#C9C3B6',
      ink3: '#9FA6B8', // Verified >= 5.1:1 contrast on #0E1424
      line: '#2A3350',
      gold: '#C9A66B',
      goldInk: '#DEC089',
      primary: '#E8DCC2',
      success: '#5EB38A',
      warning: '#E5AE52',
      danger: '#E57373',
    },
  },
} as const;
