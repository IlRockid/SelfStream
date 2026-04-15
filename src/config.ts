export const config = {
  tmdbApiKey: process.env.TMDB_API_KEY || "YOUR_TMDB_API_KEY_HERE",
  vixsrcDomain: "vixsrc.to",
  vixcloudDomain: "vixcloud.co"
};

export const AVAILABLE_LANGUAGES = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'ro', label: 'Română', flag: '🇷🇴' }
];

export interface UserConfig {
  vixEnabled: boolean;
  vixLang: string;
  cinemacityEnabled: boolean;
  cinemacityLang: string;
  animeunityEnabled: boolean;
}

export const DEFAULT_CONFIG: UserConfig = {
  vixEnabled: true,
  vixLang: 'it',
  cinemacityEnabled: false,
  cinemacityLang: 'it',
  animeunityEnabled: true
};

export function encodeConfig(cfg: UserConfig): string {
  return Buffer.from(JSON.stringify(cfg)).toString('base64url');
}

export function decodeConfig(token: string): UserConfig {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    return {
      vixEnabled: parsed.vixEnabled !== false,
      vixLang: parsed.vixLang || DEFAULT_CONFIG.vixLang,
      cinemacityEnabled: parsed.cinemacityEnabled === true,
      cinemacityLang: parsed.cinemacityLang || DEFAULT_CONFIG.cinemacityLang,
      animeunityEnabled: parsed.animeunityEnabled !== false
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
