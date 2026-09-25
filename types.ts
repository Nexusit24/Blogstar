
export interface CustomAISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  customPromptBn?: string;
  customPromptEn?: string;
}

export const DEFAULT_AI_SETTINGS: CustomAISettings = {
  apiKey: '',
  baseUrl: 'https://api.xkiro.com/v1',
  model: 'deepseek/deepseek-v4-flash',
  customPromptBn: '',
  customPromptEn: ''
};

export interface WPSite {
  id: string;
  name: string;
  url: string;
  username: string;
  appPassword: string;
}

export interface WPSettings {
  sites: WPSite[];
  activeSiteId?: string;
}

export type TemplateType = 'blog' | 'paragraph' | 'essay';
export type BlogStyle = 'tutorial' | 'education' | 'general';

export interface GenerationParams {
  template: TemplateType;
  blogStyle?: BlogStyle;
  topic: string;
  primaryKeywords: string;
  secondaryKeywords: string;
  targetAudience: string;
  wordCountRange: string;
  keywordDensity: number;
  language: 'bn' | 'en';
  customOutline?: string;
  additionalInfo?: string;
}

export interface GeneratedArticle {
  title: string;
  outline: string;
  content: string;
  slug: string;
  yoast_seo: {
    focus_keyword: string;
    seo_title: string;
    meta_desc: string;
  };
  image_seo: {
    alt: string;
    caption: string;
  };
  tags: string;
}

export interface WPCategory {
  id: number;
  name: string;
}

export interface WPPostResponse {
  link: string;
  id: number;
}

export interface SavedDraft {
  id: string;
  createdAt: number;
  dateFormatted: string;
  title: string;
  topic: string;
  primaryKeywords: string;
  wordCount: number;
  article: GeneratedArticle;
  params?: GenerationParams;
}
