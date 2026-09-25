import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Settings, FileText, Send, Calendar, CheckCircle, AlertCircle, Loader2, Save, ImageIcon, FolderTree, BarChart3, Globe, Code, ShieldCheck, ListChecks, LayoutList, AlignLeft, Table, Target, PlusCircle, MessageSquarePlus, Key, ExternalLink, Pencil, Trash2, RefreshCw, Sparkles, Copy, Eye, EyeOff, Cpu, Check, History, RotateCcw, Download, Upload, Edit3, HardDrive } from 'lucide-react';
import { motion } from 'motion/react';
import { marked } from 'marked';
import { GenerationParams, GeneratedArticle, WPSettings, WPCategory, CustomAISettings, DEFAULT_AI_SETTINGS, SavedDraft } from './types';
import { generateSEOArticle, testAIConnection, fetchAvailableModels, DEFAULT_PROMPT_BN, DEFAULT_PROMPT_EN } from './services/aiService';
import { publishToWP, fetchCategories, uploadMedia, ensureTags, fetchRecentPostsByCategory } from './services/wordpressService';

// Default connection settings updated with user provided credentials
const DEFAULT_WP_SETTINGS: WPSettings = {
  sites: [
    {
      id: 'sothikinfo',
      name: 'Sothik Info',
      url: 'https://sothikinfo.com',
      username: 'jarif500k@gmail.com',
      appPassword: '1nxJ wDz1 mkwl HQQm D3VF yrEV'
    },
    {
      id: 'shikkhapata',
      name: 'Shikkhapata',
      url: 'https://shikkhapata.com',
      username: 'jarif500k@gmail.com',
      appPassword: 'Kkfn Gpw2 jwFb xRQp 0vCO lUqj'
    }
  ],
  activeSiteId: 'sothikinfo'
};

const safeLocalStorageSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      try {
        localStorage.removeItem('cached_image_preview');
        localStorage.setItem(key, value);
        return true;
      } catch (innerErr) {
        console.warn('localStorage quota exceeded', innerErr);
      }
    }
    return false;
  }
};

const dataURLtoFile = (dataurl: string, filename: string): File => {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    return new File([""], filename, { type: 'image/jpeg' });
  }
};

const convertToWebP = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Pass through WebP files without conversion
    if (file.type === 'image/webp') {
      resolve(file);
      return;
    }
    
    // Only attempt conversion for other image types
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available for WebP conversion'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('WebP conversion failed: Blob generation failed'));
          return;
        }
        const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
        const newFile = new File([blob], newFileName, { type: 'image/webp' });
        resolve(newFile);
      }, 'image/webp', 0.8);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      console.error("Image loading failed for conversion:", err);
      // Fallback to original file if conversion fails
      resolve(file);
    };
  });
};

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'generate' | 'settings'>('generate');
  const [params, setParams] = useState<GenerationParams>({
    template: 'blog',
    blogStyle: 'general',
    topic: '',
    primaryKeywords: '',
    secondaryKeywords: '',
    targetAudience: '',
    wordCountRange: 'Standard (1500-2000 words)',
    keywordDensity: 1.5,
    language: 'bn',
    customOutline: '',
    additionalInfo: ''
  });
  const [aiSettings, setAiSettings] = useState<CustomAISettings>(DEFAULT_AI_SETTINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [promptLanguageTab, setPromptLanguageTab] = useState<'bn' | 'en'>('bn');
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; display_name: string; access_tier?: string }>>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; result: { success: boolean; message: string } | null }>({
    loading: false,
    result: null
  });
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [wpSettings, setWpSettings] = useState<WPSettings>(DEFAULT_WP_SETTINGS);
  const activeSite = useMemo(() => {
    if (!wpSettings?.sites || !Array.isArray(wpSettings.sites) || wpSettings.sites.length === 0) {
      return DEFAULT_WP_SETTINGS.sites[0];
    }
    return wpSettings.sites.find(s => s.id === wpSettings.activeSiteId) || wpSettings.sites[0];
  }, [wpSettings]);
  const [categories, setCategories] = useState<WPCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | undefined>();
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [article, setArticle] = useState<GeneratedArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [publishLoading, setPublishLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ link: string } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showArticleClearConfirm, setShowArticleClearConfirm] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // LocalStorage & History states
  const [history, setHistory] = useState<SavedDraft[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [articleViewMode, setArticleViewMode] = useState<'preview' | 'edit'>('preview');
  const [lastSavedNotice, setLastSavedNotice] = useState<string>('');
  const [isSavedPulsing, setIsSavedPulsing] = useState<boolean>(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const isStorageInitialized = useRef(false);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load available models from xKiro
    const loadModels = async () => {
      setLoadingModels(true);
      try {
        const list = await fetchAvailableModels();
        if (list && list.length > 0) {
          setAvailableModels(list);
        }
      } catch (e) {
        console.warn("Could not load models list", e);
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();

    // Load custom AI settings from localStorage
    const savedAi = localStorage.getItem('custom_ai_settings');
    if (savedAi) {
      try {
        const parsedAi = JSON.parse(savedAi);
        setAiSettings(prev => ({
          ...prev,
          ...parsedAi
        }));
      } catch (e) {
        console.warn("Failed to load saved custom_ai_settings", e);
      }
    }

    const savedSettings = localStorage.getItem('wp_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Validate that it has the new structure
        if (parsed && Array.isArray(parsed.sites) && parsed.sites.length > 0) {
          setWpSettings(parsed);
          loadCategories(parsed);
        } else {
          // If it's old format or invalid, use defaults
          console.warn("Invalid or old WP settings found, using defaults");
          setWpSettings(DEFAULT_WP_SETTINGS);
          loadCategories(DEFAULT_WP_SETTINGS);
        }
      } catch (e) {
        console.error("Failed to parse WP settings", e);
        setWpSettings(DEFAULT_WP_SETTINGS);
        loadCategories(DEFAULT_WP_SETTINGS);
      }
    } else {
      loadCategories(DEFAULT_WP_SETTINGS);
    }

    // Restore saved article and params
    const savedArticle = localStorage.getItem('last_generated_article');
    if (savedArticle) {
      try {
        setArticle(JSON.parse(savedArticle));
      } catch (e) {
        console.error("Failed to restore article", e);
      }
    }

    const savedParams = localStorage.getItem('last_generation_params');
    if (savedParams) {
      try {
        setParams(JSON.parse(savedParams));
      } catch (e) {
        console.error("Failed to restore params", e);
      }
    }

    // Restore saved drafts / history
    const savedHistory = localStorage.getItem('saved_articles_history');
    if (savedHistory) {
      try {
        const parsedHist = JSON.parse(savedHistory);
        if (Array.isArray(parsedHist)) {
          setHistory(parsedHist);
        }
      } catch (e) {
        console.error("Failed to restore saved history", e);
      }
    }

    // Restore active tab
    const savedTab = localStorage.getItem('writer_active_tab') as 'generate' | 'settings' | null;
    if (savedTab === 'generate' || savedTab === 'settings') {
      setActiveTab(savedTab);
    }

    // Restore prompt language tab
    const savedPromptTab = localStorage.getItem('prompt_lang_tab') as 'bn' | 'en' | null;
    if (savedPromptTab === 'bn' || savedPromptTab === 'en') {
      setPromptLanguageTab(savedPromptTab);
    }

    // Restore cached image preview
    const savedImg = localStorage.getItem('cached_image_preview');
    if (savedImg) {
      try {
        setImagePreview(savedImg);
        setSelectedImage(dataURLtoFile(savedImg, 'restored-image.jpg'));
      } catch (e) {
        console.warn("Failed to restore image preview", e);
      }
    }

    setScheduleDate(getDefaultScheduleDate());

    // Mark storage as initialized after reading all stored state
    setTimeout(() => {
      isStorageInitialized.current = true;
      const now = new Date();
      setLastSavedNotice(now.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' }));
    }, 150);

    // Global error handler to catch unhandled fetch errors
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('Failed to fetch')) {
        setError(params.language === 'en' ? 'Server connection error (Failed to fetch). Please check your internet connection or refresh the page.' : 'সার্ভারের সাথে যোগাযোগ করতে সমস্যা হচ্ছে (Failed to fetch)। দয়া করে ইন্টারনেট কানেকশন চেক করুন বা পেজটি রিফ্রেশ করুন।');
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const triggerSaveIndicator = () => {
    setIsSavedPulsing(true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString(params.language === 'en' ? 'en-US' : 'bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSavedNotice(timeStr);
    setTimeout(() => setIsSavedPulsing(false), 1200);
  };

  // Auto-save params to localStorage on any input change
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    safeLocalStorageSet('last_generation_params', JSON.stringify(params));
    triggerSaveIndicator();
  }, [params]);

  // Auto-save article to localStorage on generation or edit
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    if (article) {
      safeLocalStorageSet('last_generated_article', JSON.stringify(article));
    } else {
      localStorage.removeItem('last_generated_article');
    }
    triggerSaveIndicator();
  }, [article]);

  // Auto-save wpSettings to localStorage
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    safeLocalStorageSet('wp_settings', JSON.stringify(wpSettings));
    triggerSaveIndicator();
  }, [wpSettings]);

  // Auto-save aiSettings to localStorage
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    safeLocalStorageSet('custom_ai_settings', JSON.stringify(aiSettings));
    triggerSaveIndicator();
  }, [aiSettings]);

  // Auto-save activeTab to localStorage
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    safeLocalStorageSet('writer_active_tab', activeTab);
  }, [activeTab]);

  // Auto-save promptLanguageTab to localStorage
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    safeLocalStorageSet('prompt_lang_tab', promptLanguageTab);
  }, [promptLanguageTab]);

  // Auto-save selectedCategory to localStorage
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    if (selectedCategory !== undefined) {
      safeLocalStorageSet('selected_wp_category', String(selectedCategory));
    } else {
      localStorage.removeItem('selected_wp_category');
    }
  }, [selectedCategory]);

  // Auto-save history drafts to localStorage
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    safeLocalStorageSet('saved_articles_history', JSON.stringify(history));
  }, [history]);

  // Auto-save cached image preview to localStorage
  useEffect(() => {
    if (!isStorageInitialized.current) return;
    if (imagePreview) {
      if (imagePreview.length < 2500000) {
        safeLocalStorageSet('cached_image_preview', imagePreview);
      }
    } else {
      localStorage.removeItem('cached_image_preview');
    }
  }, [imagePreview]);

  const saveDraftToHistory = (art: GeneratedArticle, genParams?: GenerationParams) => {
    const wordCount = (art.title + ' ' + (art.content || '')).replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    const now = new Date();
    const formatted = now.toLocaleString(params.language === 'en' ? 'en-US' : 'bn-BD', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const newDraft: SavedDraft = {
      id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: Date.now(),
      dateFormatted: formatted,
      title: art.title || (params.language === 'en' ? 'Untitled Article' : 'শিরোনামহীন আর্টিকেল'),
      topic: genParams?.topic || params.topic || '',
      primaryKeywords: genParams?.primaryKeywords || params.primaryKeywords || art.yoast_seo?.focus_keyword || '',
      wordCount,
      article: art,
      params: genParams ? { ...genParams } : { ...params }
    };

    setHistory(prev => {
      const filtered = prev.filter(d => d.title !== newDraft.title);
      const updated = [newDraft, ...filtered].slice(0, 30);
      safeLocalStorageSet('saved_articles_history', JSON.stringify(updated));
      return updated;
    });
  };

  const restoreDraft = (draft: SavedDraft) => {
    setArticle(draft.article);
    if (draft.params) {
      setParams(draft.params);
      safeLocalStorageSet('last_generation_params', JSON.stringify(draft.params));
    }
    safeLocalStorageSet('last_generated_article', JSON.stringify(draft.article));
    setActiveTab('generate');
    setShowHistoryModal(false);
  };

  const deleteDraft = (id: string) => {
    setHistory(prev => {
      const updated = prev.filter(d => d.id !== id);
      safeLocalStorageSet('saved_articles_history', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllHistory = () => {
    setHistory([]);
    localStorage.removeItem('saved_articles_history');
    setShowClearHistoryConfirm(false);
  };

  const exportAllDataAsJson = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      currentParams: params,
      currentArticle: article,
      historyDrafts: history,
      wpSites: wpSettings.sites.map(s => ({ id: s.id, name: s.name, url: s.url, username: s.username })),
      aiSettings: {
        baseUrl: aiSettings.baseUrl,
        model: aiSettings.model,
        customPromptBn: aiSettings.customPromptBn,
        customPromptEn: aiSettings.customPromptEn
      }
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bangla-seo-articles-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.historyDrafts && Array.isArray(data.historyDrafts)) {
          setHistory(data.historyDrafts);
          safeLocalStorageSet('saved_articles_history', JSON.stringify(data.historyDrafts));
        }
        if (data.currentArticle) {
          setArticle(data.currentArticle);
          safeLocalStorageSet('last_generated_article', JSON.stringify(data.currentArticle));
        }
        if (data.currentParams) {
          setParams(data.currentParams);
          safeLocalStorageSet('last_generation_params', JSON.stringify(data.currentParams));
        }
        alert(params.language === 'en' ? 'Backup restored successfully from file!' : 'ফাইল থেকে ব্যাকআপ সফলভাবে রিস্টোর হয়েছে!');
      } catch (err) {
        console.error("Failed to parse backup", err);
        alert(params.language === 'en' ? 'Invalid backup file format' : 'ভুল ব্যাকআপ ফাইল ফরম্যাট');
      }
    };
    reader.readAsText(file);
  };

  const getDefaultScheduleDate = () => {
    const date = new Date();
    date.setHours(date.getHours() + 24);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  };

  const loadCategories = async (site: any) => {
    if (!site?.url || !site?.appPassword) return;
    setCategoryLoading(true);
    setCategoryError(null);
    try {
      const cats = await fetchCategories(site);
      setCategories(cats);
      // Restore selectedCategory if present
      const savedCat = localStorage.getItem('selected_wp_category');
      if (savedCat) {
        const catNum = Number(savedCat);
        if (cats.some(c => c.id === catNum)) {
          setSelectedCategory(catNum);
        }
      }
    } catch (err: any) {
      console.error('Failed to load categories', err);
      setCategoryError(params.language === 'en' ? 'Failed to load categories. Check URL and Application Password.' : 'ক্যাটাগরি লোড করতে সমস্যা হয়েছে। আপনার ইউআরএল এবং অ্যাপ্লিকেশন পাসওয়ার্ড চেক করুন।');
    } finally {
      setCategoryLoading(false);
    }
  };

  const saveSettings = () => {
    localStorage.setItem('wp_settings', JSON.stringify(wpSettings));
    localStorage.setItem('custom_ai_settings', JSON.stringify(aiSettings));
    loadCategories(activeSite);
    setSaveSuccessNotice(true);
    setTimeout(() => setSaveSuccessNotice(false), 3500);
    setActiveTab('generate');
  };

  const handleTestAIConnection = async () => {
    setTestStatus({ loading: true, result: null });
    try {
      const res = await testAIConnection(aiSettings);
      setTestStatus({ loading: false, result: res });
    } catch (err: any) {
      setTestStatus({
        loading: false,
        result: {
          success: false,
          message: err.message || 'Connection failed'
        }
      });
    }
  };

  useEffect(() => {
    if (activeSite) {
      loadCategories(activeSite);
    }
  }, [wpSettings.activeSiteId]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < 6 ? prev + 1 : prev));
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const loadingSteps = params.language === 'bn' ? [
    'টপিক বিশ্লেষণ করা হচ্ছে...',
    'কিওয়ার্ড রিসার্চ করা হচ্ছে...',
    'আর্টিকেলের স্ট্রাকচার তৈরি হচ্ছে...',
    'কন্টেন্ট লেখা হচ্ছে...',
    'এসইও অপ্টিমাইজেশন করা হচ্ছে...',
    'ইমেজ প্রসেসিং করা হচ্ছে...',
    'ফাইনাল টাচ দেওয়া হচ্ছে...'
  ] : [
    'Analyzing topic...',
    'Researching keywords...',
    'Creating article structure...',
    'Writing content...',
    'Optimizing SEO...',
    'Processing image...',
    'Giving final touches...'
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const generateAIImage = async () => {
    if (!params.primaryKeywords) {
      setError(params.language === 'en' ? 'Please enter the main keyword first to generate an image.' : 'ইমেজ জেনারেট করার জন্য আগে মেইন কিওয়ার্ড দিন।');
      return;
    }
    setIsGeneratingImage(true);
    try {
      const seed = Math.floor(Math.random() * 1000000);
      const prompt = encodeURIComponent(`high quality professional blog featured image for: ${params.primaryKeywords}, realistic, 16:9 aspect ratio`);
      const imageUrl = `https://pollinations.ai/p/${prompt}?width=1280&height=720&seed=${seed}&model=flux`;
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'ai-featured-image.jpg', { type: 'image/jpeg' });
      setSelectedImage(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("AI Image generation failed", err);
      setError(params.language === 'en' ? 'Failed to generate AI image.' : 'AI ইমেজ জেনারেট করতে সমস্যা হয়েছে।');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleClearInputs = () => {
    setParams({
      template: 'blog',
      blogStyle: 'general',
      topic: '',
      primaryKeywords: '',
      secondaryKeywords: '',
      targetAudience: '',
      wordCountRange: 'Standard (1500-2000 words)',
      keywordDensity: 1.5,
      language: params.language,
      customOutline: '',
      additionalInfo: ''
    });
    setSelectedImage(null);
    setImagePreview(null);
    localStorage.removeItem('last_generation_params');
    localStorage.removeItem('cached_image_preview');
    setShowClearConfirm(false);
  };

  const handleGenerate = async () => {
    if (!aiSettings.apiKey?.trim()) {
      setError(params.language === 'en' 
        ? 'xKiro API Key is required. Please open Settings and enter your API Key.' 
        : 'xKiro API Key দেওয়া হয়নি। অনুগ্রহ করে সেটিংস-এ গিয়ে xkiro.com-এর API Key প্রদান করুন।');
      setActiveTab('settings');
      return;
    }

    if (!params.topic || !params.primaryKeywords) {
      setError(params.language === 'en' ? 'Please provide the topic and main keywords.' : 'দয়া করে টপিক এবং মেইন কিওয়ার্ডগুলো লিখুন।');
      return;
    }
    
    // Save params to local storage immediately
    safeLocalStorageSet('last_generation_params', JSON.stringify(params));
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await generateSEOArticle(params, aiSettings);
      setArticle(result);
      // Save article to local storage and history
      safeLocalStorageSet('last_generated_article', JSON.stringify(result));
      saveDraftToHistory(result, params);
    } catch (err: any) {
      let msg = err.message || 'Unknown error';
      if (msg.includes('Failed to fetch')) {
        msg = params.language === 'en' ? 'Server connection error (Failed to fetch). Please check your internet connection.' : 'সার্ভারের সাথে যোগাযোগ করতে সমস্যা হচ্ছে (Failed to fetch)। দয়া করে আপনার ইন্টারনেট কানেকশন চেক করুন।';
      }
      setError((params.language === 'en' ? 'Error generating article: ' : 'আর্টিকেল জেনারেট করতে সমস্যা হয়েছে: ') + msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const injectInternalLinks = (content: string, posts: {title: string, link: string}[], language: 'bn' | 'en') => {
    if (!posts || posts.length === 0) return content;
    
    const paragraphs = content.split('</p>');
    const filteredParagraphs = paragraphs.filter(p => p.trim() !== '');
    
    let newContentParts = [...filteredParagraphs];
    const prefix = language === 'bn' ? 'আরও পড়ুন' : 'Read More';
    
    // 1. Inject inline links (first 2 posts) if content is long enough
    if (newContentParts.length >= 4) {
      if (posts.length >= 1) {
        const link1Html = `<p><strong>${prefix}: <a href="${posts[0].link}" rel="dofollow">${posts[0].title}</a></strong></p>`;
        const insertIndex = 2;
        newContentParts.splice(insertIndex, 0, link1Html);
      }
      
      if (posts.length >= 2) {
        const link2Html = `<p><strong>${prefix}: <a href="${posts[1].link}" rel="dofollow">${posts[1].title}</a></strong></p>`;
        const insertIndex = Math.min(newContentParts.length - 1, 6);
        newContentParts.splice(insertIndex, 0, link2Html);
      }
    }
    
    let finalContent = newContentParts.join('</p>') + (content.endsWith('</p>') ? '</p>' : '');

    // 2. Inject Related Posts section at the end (remaining posts, up to 5)
    const relatedPosts = posts.slice(2, 7);
    if (relatedPosts.length > 0) {
      const heading = language === 'bn' ? 'আমাদের এইখানে আরো দেখুন......' : 'See More from Us......';
      let relatedHtml = `\n\n<p style="margin-top: 40px;"><strong>${heading}</strong></p>\n<ul>`;
      relatedPosts.forEach(post => {
        relatedHtml += `\n  <li><a href="${post.link}" rel="dofollow">${post.title}</a></li>`;
      });
      relatedHtml += '\n</ul>';
      finalContent += relatedHtml;
    }
    
    return finalContent;
  };

  const handlePublish = async (isScheduling = false) => {
    if (!article || !activeSite?.url || !activeSite?.username || !activeSite?.appPassword) {
      setError(params.language === 'en' ? 'Please configure WordPress settings.' : 'দয়া করে ওয়ার্ডপ্রেস সেটিংস ঠিক করুন।');
      return;
    }
    setPublishLoading(true);
    setError(null);
    try {
      let mediaId: number | undefined;
      if (selectedImage) {
        let imageToUpload = selectedImage;
        try {
           if (selectedImage.type.startsWith('image/')) {
               imageToUpload = await convertToWebP(selectedImage);
           }
        } catch (convErr) {
           console.error("WebP conversion failed", convErr);
        }
        
        // Use primary keywords as the main keyword for image metadata
        const mainKeyword = params.primaryKeywords;
        
        mediaId = await uploadMedia(activeSite, imageToUpload, {
          title: mainKeyword,
          alt_text: mainKeyword,
          caption: mainKeyword,
          description: mainKeyword
        });
      }

      let tagIds: number[] = [];
      if (article.tags) {
        const tagList = article.tags.split(',').map(t => t.trim());
        tagIds = await ensureTags(activeSite, tagList);
      }

      let finalScheduleDate: string | undefined = undefined;
      if (isScheduling && scheduleDate) {
        finalScheduleDate = `${scheduleDate}:00`;
      }

      let finalContent = marked.parse(article.content) as string;
      if (selectedCategory) {
        try {
          // Fetch up to 7 posts: 2 for inline, 5 for the end section
          const recentPosts = await fetchRecentPostsByCategory(activeSite, selectedCategory, 7);
          finalContent = injectInternalLinks(finalContent, recentPosts, params.language);
        } catch (linkErr) {
          console.error("Internal linking fetch failed", linkErr);
        }
      }

      const result = await publishToWP(activeSite, {
        title: article.title,
        content: finalContent,
        slug: article.slug,
        date: finalScheduleDate,
        category: selectedCategory,
        tags: tagIds,
        metaDescription: article.yoast_seo.meta_desc,
        focusKeyword: article.yoast_seo.focus_keyword,
        seoTitle: article.yoast_seo.seo_title,
        featuredMediaId: mediaId
      });
      setSuccess({ link: result.link });
      setShowScheduleModal(false);
      
      // Keep article saved in history and local storage
      saveDraftToHistory(article, params);
    } catch (err: any) {
      console.error("Publish error:", err);
      setError(err.message || (params.language === 'en' ? 'Failed to publish to WordPress.' : 'ওয়ার্ডপ্রেসে পাবলিশ করতে সমস্যা হয়েছে।'));
    } finally {
      setPublishLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!article) return;
    const htmlContent = `<h1>${article.title}</h1>\n\n${marked.parse(article.content)}`;
    navigator.clipboard.writeText(htmlContent).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    });
  };

  const clearCurrentArticle = () => {
    // Preserve current article in history before clearing from screen
    if (article) {
      saveDraftToHistory(article, params);
    }
    setArticle(null);
    localStorage.removeItem('last_generated_article');
    setShowArticleClearConfirm(false);
  };

  const stats = useMemo(() => {
    if (!article) return null;
    const htmlContent = marked.parse(article.content) as string;
    const text = (article.title + ' ' + htmlContent).replace(/<[^>]*>/g, ' ');
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const keyword = article.yoast_seo.focus_keyword.toLowerCase();
    const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = text.toLowerCase().match(regex);
    const keywordCount = matches ? matches.length : 0;
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
    
    // Check keyword in title and subheadings
    const hasInTitle = article.title.toLowerCase().includes(keyword);
    const h2Matches = htmlContent.match(/<h2[^>]*>(.*?)<\/h2>/gi) || [];
    const h3Matches = htmlContent.match(/<h3[^>]*>(.*?)<\/h3>/gi) || [];
    const inH2Count = h2Matches.filter(h => h.toLowerCase().includes(keyword)).length;
    const inH3Count = h3Matches.filter(h => h.toLowerCase().includes(keyword)).length;

    return { 
      wordCount, 
      keywordCount,
      density: density.toFixed(2), 
      seoTitleLength: article.yoast_seo.seo_title.length,
      metaDescLength: article.yoast_seo.meta_desc.length,
      hasTable: htmlContent.includes('<table'),
      hasTakeaways: htmlContent.includes('<blockquote') || htmlContent.includes('একনজরে'),
      hasInTitle,
      inH2Count,
      inH3Count
    };
  }, [article]);

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-lg text-white shadow-lg">
                <Target size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 hidden sm:block">Bangla SEO AI Writer Pro</h1>
              </div>
            </div>

            {/* LocalStorage Auto-Save Status Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/90 text-emerald-800 text-xs font-semibold" title={params.language === 'en' ? 'Everything is automatically preserved in LocalStorage' : 'ইনপুট, ড্রাফট ও সেটিংস লোকালস্টোরেজে সার্বক্ষণিক সংরক্ষিত হচ্ছে'}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isSavedPulsing ? 'scale-150' : ''}`}></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{params.language === 'en' ? 'LocalStorage Active' : 'লোকালস্টোরেজে সেভড'}</span>
              {lastSavedNotice && <span className="text-[10px] text-emerald-600 font-normal">({lastSavedNotice})</span>}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={() => setShowHistoryModal(true)} 
                className="px-3 sm:px-3.5 py-2 rounded-lg flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all shadow-sm active:scale-95"
                title={params.language === 'en' ? 'Saved Drafts & Article History' : 'পূর্বে সেভ করা সকল ড্রাফট ও হিস্ট্রি দেখুন'}
              >
                <History size={16} className="text-blue-600" />
                <span className="hidden xs:inline">{params.language === 'en' ? 'Drafts' : 'হিস্ট্রি ও ড্রাফট'}</span>
                {history.length > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {history.length}
                  </span>
                )}
              </button>
              <button onClick={() => setActiveTab('generate')} className={`px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold transition-all ${activeTab === 'generate' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                <FileText size={16} /> <span className="hidden xs:inline">{params.language === 'en' ? 'Writer' : 'রাইটার'}</span>
              </button>
              <button onClick={() => setActiveTab('settings')} className={`px-3 sm:px-4 py-2 rounded-lg flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold transition-all ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                <Settings size={16} /> <span className="hidden xs:inline">{params.language === 'en' ? 'Settings' : 'সেটিংস'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex flex-col gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <div className="flex-grow">
                <p className="font-bold">Error!</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
            {error.includes('কুকি') && (
              <div className="ml-8">
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-all flex items-center gap-2 shadow-md"
                >
                  <ExternalLink size={16} /> নতুন ট্যাবে ওপেন করুন
                </button>
              </div>
            )}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg flex flex-col gap-2 text-green-700 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <CheckCircle size={20} className="shrink-0" />
              <p className="font-bold text-lg">এসইও-অপ্টিমাইজড পাবলিশ সফল!</p>
            </div>
            <a href={success.link} target="_blank" rel="noreferrer" className="text-blue-600 font-semibold underline ml-8 hover:text-blue-800">পোস্টটি দেখুন →</a>
          </div>
        )}

        {saveSuccessNotice && (
          <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-lg flex items-center gap-3 text-emerald-800 animate-in fade-in slide-in-from-top-2 shadow-sm">
            <CheckCircle size={20} className="text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">{params.language === 'en' ? 'Settings Saved Successfully!' : 'সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!'}</p>
              <p className="text-xs text-emerald-700">{params.language === 'en' ? 'Your AI configuration and WordPress sites have been updated.' : 'আপনার AI কনফিগারেশন এবং ওয়ার্ডপ্রেস সাইট আপডেট করা হয়েছে।'}</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' ? (
          <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-300">
            {/* Custom AI API Settings Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-50/70 to-indigo-50/70 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Sparkles className="text-purple-600" size={22} /> {params.language === 'en' ? 'Custom AI API Configuration (xKiro)' : 'কাস্টম AI API কনফিগারেশন (xKiro)'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {params.language === 'en' 
                      ? 'Configure xKiro or any OpenAI-compatible API to generate high quality SEO articles.' 
                      : 'xkiro.com বা যেকোনো OpenAI-সাপোর্টেড কাস্টম গেটওয়ে দিয়ে DeepSeek বা অন্যান্য মডেলের সাহায্যে আর্টিকেল তৈরি করুন।'}
                  </p>
                </div>
                <a 
                  href="https://xkiro.com" 
                  target="_blank" 
                  rel="noreferrer" 
                  className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-100/80 hover:bg-purple-200/80 px-3 py-1.5 rounded-lg transition-all"
                >
                  <span>xKiro Dashboard</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {/* xKiro API Key */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                      <Key size={14} className="text-purple-600" /> xKiro API Key <span className="text-red-500">*</span>
                    </label>
                    <a 
                      href="https://xkiro.com" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="sm:hidden text-xs text-purple-600 font-bold flex items-center gap-1"
                    >
                      xkiro.com <ExternalLink size={12} />
                    </a>
                  </div>
                  <div className="relative">
                    <input 
                      type={showApiKey ? "text" : "password"}
                      value={aiSettings.apiKey}
                      onChange={(e) => setAiSettings({ ...aiSettings, apiKey: e.target.value })}
                      placeholder="xkiro.com-এর API Key পেস্ট করুন..."
                      className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm bg-gray-50/50 focus:bg-white transition-all"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 rounded-md"
                      title={showApiKey ? "Hide Key" : "Show Key"}
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                    {params.language === 'en' 
                      ? 'Sign up at xkiro.com and copy your API key from the dashboard' 
                      : 'xkiro.com-এ অ্যাকাউন্ট খুলে ড্যাশবোর্ড থেকে key কপি করে বসান'}
                  </p>
                </div>

                {/* API Base URL */}
                <div>
                  <label className="block text-xs font-black text-gray-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Globe size={14} className="text-blue-600" /> API Base URL
                  </label>
                  <input 
                    type="text"
                    value={aiSettings.baseUrl}
                    onChange={(e) => setAiSettings({ ...aiSettings, baseUrl: e.target.value })}
                    placeholder="https://api.xkiro.com/v1"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm bg-gray-50/50 focus:bg-white transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    {params.language === 'en' 
                      ? 'https://api.xkiro.com/v1 (Default, no need to change)' 
                      : 'https://api.xkiro.com/v1 (ডিফল্ট, বদলানোর দরকার নেই)'}
                  </p>
                </div>

                {/* Model */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                      <Cpu size={14} className="text-indigo-600" /> Model (মডেল)
                    </label>
                    <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                      ইচ্ছামত কাস্টম মডেল লিখুন
                    </span>
                  </div>
                  <input 
                    type="text"
                    list="xkiro-models-list"
                    value={aiSettings.model}
                    onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                    placeholder="deepseek/deepseek-v4-flash"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm bg-gray-50/50 focus:bg-white transition-all"
                  />
                  <datalist id="xkiro-models-list">
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id}>{m.display_name} ({m.access_tier || 'active'})</option>
                    ))}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {params.language === 'en' 
                      ? 'deepseek/deepseek-v4-flash (Check exact ID on docs.xkiro.com Models page - names may vary on gateways)' 
                      : 'deepseek/deepseek-v4-flash (docs.xkiro.com-এর Models পেজে একবার এই exact ID মিলিয়ে নিন — গেটওয়ে হওয়ায় নাম মাঝে মাঝে ভিন্ন হতে পারে)'}
                  </p>

                  {/* Popular Preset Models */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        {params.language === 'en' ? 'Verified xKiro Presets:' : 'ভেরিফাইড xKiro মডেল প্রিসেট:'}
                      </p>
                      {availableModels.length > 0 && (
                        <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-bold">
                          {availableModels.length} টি মডেল পাওয়া গেছে
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
                        { id: 'deepseek/deepseek-chat-v3.1', label: 'DeepSeek V3.1 (Stable)' },
                        { id: 'deepseek/deepseek-v3.2', label: 'DeepSeek V3.2' },
                        { id: 'deepseek/deepseek-v4.1-flash:free', label: 'DeepSeek V4.1 Flash' },
                        { id: 'qwen/qwen3.5-flash:free', label: 'Qwen 3.5 Flash (Free)' },
                        { id: 'sensenova/sensenova-6.8-flash-lite', label: 'SenseNova 6.8 Lite' }
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setAiSettings({ ...aiSettings, model: preset.id })}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all flex items-center gap-1.5 ${
                            aiSettings.model === preset.id
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                          }`}
                        >
                          {aiSettings.model === preset.id && <Check size={12} />}
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Test Connection Button & Status */}
                <div className="pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={testStatus.loading || !aiSettings.apiKey}
                      onClick={handleTestAIConnection}
                      className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {testStatus.loading ? <Loader2 size={15} className="animate-spin text-purple-400" /> : <RefreshCw size={15} />}
                      <span>{params.language === 'en' ? 'Test API Connection' : 'টেস্ট কানেকশন (Test Connection)'}</span>
                    </button>
                    {!aiSettings.apiKey && (
                      <span className="text-xs text-amber-600 font-medium">
                        {params.language === 'en' ? 'Enter API Key first to test' : 'কানেকশন টেস্ট করার জন্য আগে API Key লিখুন'}
                      </span>
                    )}
                  </div>

                  {testStatus.result && (
                    <div className={`mt-3 p-3.5 rounded-xl border text-xs font-medium animate-in fade-in duration-200 ${
                      testStatus.result.success 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      <div className="flex items-start gap-2">
                        {testStatus.result.success ? (
                          <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-bold">{testStatus.result.success ? (params.language === 'en' ? 'Success!' : 'সংযোগ সফল!') : (params.language === 'en' ? 'Connection Failed' : 'সংযোগ ব্যর্থ')}</p>
                          <p className="mt-0.5">{testStatus.result.message}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Custom Article System Prompt Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <Code className="text-blue-600" size={22} /> {params.language === 'en' ? 'Custom Article Writing Prompt' : 'কাস্টম আর্টিকেল লেখার প্রম্পট'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {params.language === 'en' 
                      ? 'Customize the system prompt sent to AI for generating articles. Everything is saved in LocalStorage.' 
                      : 'AI মডেলকে আর্টিকেল জেনারেট করার জন্য যে সিস্টেম প্রম্পট পাঠানো হবে তা প্রয়োজনমতো কাস্টমাইজ করুন। সবকিছু লোকাল স্টোরেজে সংরক্ষিত থাকে।'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="bg-gray-100 p-1 rounded-xl flex gap-1 border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setPromptLanguageTab('bn')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        promptLanguageTab === 'bn' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      বাংলা প্রম্পট
                    </button>
                    <button
                      type="button"
                      onClick={() => setPromptLanguageTab('en')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        promptLanguageTab === 'en' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      English Prompt
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (promptLanguageTab === 'bn') {
                        const updated = { ...aiSettings, customPromptBn: DEFAULT_PROMPT_BN };
                        setAiSettings(updated);
                        localStorage.setItem('custom_ai_settings', JSON.stringify(updated));
                      } else {
                        const updated = { ...aiSettings, customPromptEn: DEFAULT_PROMPT_EN };
                        setAiSettings(updated);
                        localStorage.setItem('custom_ai_settings', JSON.stringify(updated));
                      }
                    }}
                    className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-blue-200 active:scale-95"
                    title={params.language === 'en' ? 'Load default built-in prompt' : 'ডিফল্ট প্রম্পট লোড করুন'}
                  >
                    <RefreshCw size={13} />
                    <span>{params.language === 'en' ? 'Reset Default' : 'ডিফল্ট লোড করুন'}</span>
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-4">
                {/* Dynamic Variables Pill Info */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100/80">
                  <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1.5">
                    {params.language === 'en' ? 'Available Dynamic Variables (replaced automatically):' : 'ব্যবহারযোগ্য ডায়নামিক ভেরিয়েবল (প্রম্পটে স্বয়ংক্রিয়ভাবে ইনপুট থেকে প্রতিস্থাপিত হবে):'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {['{topic}', '{primaryKeywords}', '{secondaryKeywords}', '{wordCountRange}', '{targetAudience}', '{currentYear}', '{customOutline}', '{additionalInfo}'].map((v) => (
                      <code 
                        key={v} 
                        className="text-[11px] bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded-md font-mono font-bold select-all"
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                </div>

                {promptLanguageTab === 'bn' ? (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={13} className="text-blue-600" /> বাংলা আর্টিকেল সিস্টেম প্রম্পট (Bengali System Prompt)
                      </label>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {(aiSettings.customPromptBn !== undefined && aiSettings.customPromptBn !== '' ? aiSettings.customPromptBn : DEFAULT_PROMPT_BN).length} অক্ষর
                      </span>
                    </div>
                    <textarea
                      rows={14}
                      value={aiSettings.customPromptBn !== undefined && aiSettings.customPromptBn !== '' ? aiSettings.customPromptBn : DEFAULT_PROMPT_BN}
                      onChange={(e) => {
                        const updated = { ...aiSettings, customPromptBn: e.target.value };
                        setAiSettings(updated);
                        localStorage.setItem('custom_ai_settings', JSON.stringify(updated));
                      }}
                      className="w-full p-4 border border-gray-200 rounded-xl font-mono text-xs text-gray-800 bg-gray-50/40 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed transition-all resize-y"
                      placeholder="বাংলা আর্টিকেল তৈরির প্রম্পট লিখুন..."
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles size={13} className="text-blue-600" /> English Article System Prompt (ইংরেজি সিস্টেম প্রম্পট)
                      </label>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {(aiSettings.customPromptEn !== undefined && aiSettings.customPromptEn !== '' ? aiSettings.customPromptEn : DEFAULT_PROMPT_EN).length} characters
                      </span>
                    </div>
                    <textarea
                      rows={14}
                      value={aiSettings.customPromptEn !== undefined && aiSettings.customPromptEn !== '' ? aiSettings.customPromptEn : DEFAULT_PROMPT_EN}
                      onChange={(e) => {
                        const updated = { ...aiSettings, customPromptEn: e.target.value };
                        setAiSettings(updated);
                        localStorage.setItem('custom_ai_settings', JSON.stringify(updated));
                      }}
                      className="w-full p-4 border border-gray-200 rounded-xl font-mono text-xs text-gray-800 bg-gray-50/40 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed transition-all resize-y"
                      placeholder="Write English article prompt..."
                    />
                  </div>
                )}
              </div>
            </div>

            {/* WordPress Sites Management Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Globe className="text-blue-600" size={20} /> {params.language === 'en' ? 'WordPress Site Management' : 'ওয়ার্ডপ্রেস সাইট ম্যানেজমেন্ট'}
                </h2>
                <button 
                  onClick={() => {
                    const newSite = { id: Date.now().toString(), name: 'New Site', url: '', username: '', appPassword: '' };
                    setWpSettings({ ...wpSettings, sites: [...wpSettings.sites, newSite] });
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
                >
                  <PlusCircle size={16} /> {params.language === 'en' ? 'Add New Site' : 'নতুন সাইট যোগ করুন'}
                </button>
              </div>
              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 gap-6">
                  {wpSettings.sites.map((site, index) => (
                    <div key={site.id} className="p-6 border border-gray-200 rounded-2xl bg-gray-50/30 space-y-4 relative group">
                      <button 
                        onClick={() => {
                          const newSites = wpSettings.sites.filter(s => s.id !== site.id);
                          setWpSettings({ ...wpSettings, sites: newSites });
                        }}
                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title={params.language === 'en' ? 'Delete site' : 'সাইট মুছুন'}
                      >
                        <Trash2 size={18} />
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{params.language === 'en' ? 'Site Name' : 'সাইটের নাম'}</label>
                          <input 
                            type="text" 
                            value={site.name} 
                            onChange={(e) => {
                              const newSites = [...wpSettings.sites];
                              newSites[index].name = e.target.value;
                              setWpSettings({ ...wpSettings, sites: newSites });
                            }} 
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{params.language === 'en' ? 'WordPress URL' : 'ওয়ার্ডপ্রেস URL'}</label>
                          <input 
                            type="url" 
                            value={site.url} 
                            onChange={(e) => {
                              const newSites = [...wpSettings.sites];
                              newSites[index].url = e.target.value;
                              setWpSettings({ ...wpSettings, sites: newSites });
                            }} 
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{params.language === 'en' ? 'Username' : 'ইউজারনেম'}</label>
                          <input 
                            type="text" 
                            value={site.username} 
                            onChange={(e) => {
                              const newSites = [...wpSettings.sites];
                              newSites[index].username = e.target.value;
                              setWpSettings({ ...wpSettings, sites: newSites });
                            }} 
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{params.language === 'en' ? 'Application Password' : 'অ্যাপ্লিকেশন পাসওয়ার্ড'}</label>
                          <input 
                            type="password" 
                            value={site.appPassword} 
                            onChange={(e) => {
                              const newSites = [...wpSettings.sites];
                              newSites[index].appPassword = e.target.value;
                              setWpSettings({ ...wpSettings, sites: newSites });
                            }} 
                            className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LocalStorage & Data Persistence Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <HardDrive className="text-emerald-600" size={22} /> {params.language === 'en' ? 'LocalStorage & Data Backup' : 'লোকালস্টোরেজ ও ডেটা ব্যাকআপ'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {params.language === 'en' 
                      ? 'All your inputs, settings, and generated articles are automatically preserved in your browser.' 
                      : 'আপনার সকল ইনপুট, কনফিগারেশন এবং তৈরি করা আর্টিকেল স্বয়ংক্রিয়ভাবে ব্রাউজারের লোকালস্টোরেজে সংরক্ষিত থাকে।'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-100/70 px-3 py-1.5 rounded-xl font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{params.language === 'en' ? 'Auto-Save Active' : 'অটো-সেভ সক্রিয়'}</span>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-[11px] font-bold text-gray-500 uppercase">{params.language === 'en' ? 'Saved Drafts in History' : 'হিস্ট্রিতে সেভড ড্রাফট'}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{history.length}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-[11px] font-bold text-gray-500 uppercase">{params.language === 'en' ? 'Active Article' : 'বর্তমান সক্রিয় আর্টিকেল'}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{article ? (params.language === 'en' ? 'Saved' : 'সংরক্ষিত') : (params.language === 'en' ? 'None' : 'নেই')}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-[11px] font-bold text-gray-500 uppercase">{params.language === 'en' ? 'Configured WP Sites' : 'সংযুক্ত ওয়ার্ডপ্রেস সাইট'}</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{wpSettings.sites.length}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHistoryModal(true)}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 active:scale-95"
                  >
                    <History size={16} />
                    <span>{params.language === 'en' ? 'View Saved Drafts & History' : 'সেভড ড্রাফট ও হিস্ট্রি দেখুন'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={exportAllDataAsJson}
                    className="px-4 py-2.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
                  >
                    <Download size={16} className="text-blue-600" />
                    <span>{params.language === 'en' ? 'Download JSON Backup' : 'সম্পূর্ণ ব্যাকআপ ডাউনলোড'}</span>
                  </button>

                  <input 
                    type="file" 
                    ref={backupFileInputRef} 
                    accept=".json" 
                    className="hidden" 
                    onChange={handleImportBackup} 
                  />
                  <button
                    type="button"
                    onClick={() => backupFileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
                  >
                    <Upload size={16} className="text-purple-600" />
                    <span>{params.language === 'en' ? 'Restore from Backup File' : 'ফাইল থেকে রিস্টোর'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Global Save Button */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-gray-500">
                {params.language === 'en' 
                  ? 'All changes to xKiro API, WordPress sites, and inputs are saved locally.' 
                  : 'সকল পরিবর্তন (xKiro API, ওয়ার্ডপ্রেস সাইট ও ইনপুট) ব্রাউজারের লোকাল স্টোরেজে স্বয়ংক্রিয়ভাবে সেভ হয়।'}
              </div>
              <button 
                onClick={saveSettings} 
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Save size={18} /> {params.language === 'en' ? 'Save All Settings' : 'সকল সেটিংস সেভ করুন'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {!aiSettings.apiKey && (
              <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-purple-900 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-600 text-white rounded-xl shadow-md">
                    <Key size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {params.language === 'en' ? 'xKiro API Key Required' : 'xKiro API Key সেট করা নেই'}
                    </p>
                    <p className="text-xs text-purple-700">
                      {params.language === 'en' 
                        ? 'Please configure your API key from xkiro.com in Settings to generate articles.' 
                        : 'আর্টিকেল জেনারেট করার জন্য সেটিংস এ গিয়ে xkiro.com থেকে নেওয়া API Key বসান।'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 shrink-0 flex items-center gap-1.5"
                >
                  <Settings size={14} />
                  <span>{params.language === 'en' ? 'Open Settings' : 'সেটিংস এ যান'}</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-md border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <AlignLeft size={22} className="text-blue-600" /> {params.language === 'en' ? 'SEO Inputs' : 'এসইও ইনপুট'}
                  </h2>
                  <div className="flex items-center gap-2">
                    {showClearConfirm ? (
                      <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                        <button 
                          onClick={handleClearInputs}
                          className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-all"
                        >
                          {params.language === 'en' ? 'Yes' : 'হ্যাঁ'}
                        </button>
                        <button 
                          onClick={() => setShowClearConfirm(false)}
                          className="px-3 py-1 bg-gray-200 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-300 transition-all"
                        >
                          {params.language === 'en' ? 'No' : 'না'}
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setShowClearConfirm(true)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title={params.language === 'en' ? "Clear All Inputs" : "সব ইনপুট মুছুন"}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-5">
                  {/* AI Model Quick Display / Switcher */}
                  <div className="p-3.5 bg-gradient-to-br from-purple-50/60 to-indigo-50/40 rounded-xl border border-purple-100">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <Cpu size={14} className="text-purple-600" /> {params.language === 'en' ? 'AI Model' : 'AI মডেল'}
                      </label>
                      <button 
                        type="button"
                        onClick={() => setActiveTab('settings')} 
                        className="text-[11px] font-bold text-purple-700 hover:underline"
                      >
                        {params.language === 'en' ? 'Change in Settings' : 'সেটিংস'}
                      </button>
                    </div>
                    <input 
                      type="text"
                      list="xkiro-models-list"
                      value={aiSettings.model}
                      onChange={(e) => {
                        const updated = { ...aiSettings, model: e.target.value };
                        setAiSettings(updated);
                        localStorage.setItem('custom_ai_settings', JSON.stringify(updated));
                      }}
                      placeholder="e.g. deepseek/deepseek-v4-flash"
                      className="w-full px-3 py-2 text-xs font-mono border border-purple-200 rounded-lg bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      {params.language === 'en' 
                        ? 'Model ID (customizable anytime)' 
                        : 'মডেল আইডি (যেকোনো সময় ইচ্ছামতো পরিবর্তনযোগ্য)'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Globe size={16} className="text-blue-600" /> ভাষা সিলেক্ট করুন (Language)
                    </label>
                    <select 
                      value={params.language} 
                      onChange={(e) => setParams({ ...params, language: e.target.value as any })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-gray-700"
                    >
                      <option value="bn">বাংলা (Bengali)</option>
                      <option value="en">English (ইংরেজি)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <Globe size={16} className="text-blue-600" /> {params.language === 'en' ? 'Target Website' : 'টার্গেট ওয়েবসাইট'}
                    </label>
                      <select 
                        value={wpSettings.activeSiteId} 
                        onChange={(e) => setWpSettings({ ...wpSettings, activeSiteId: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white font-bold text-blue-700"
                      >
                        {wpSettings.sites.map(site => (
                          <option key={site.id} value={site.id}>{site.name} ({site.url})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        {params.language === 'en' ? 'Article Topic' : 'আর্টিকেলের বিষয়'}
                      </label>
                      <textarea 
                        rows={2} 
                        value={params.topic} 
                        onChange={(e) => setParams({...params, topic: e.target.value})} 
                        placeholder={params.language === 'en' ? 'e.g., How to renew passport' : 'যেমন: নতুন নিয়ম অনুযায়ী পাসপোর্ট রিন্যু করার নিয়ম'} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                        <PlusCircle size={14} className="text-blue-500"/> {params.language === 'en' ? 'Main Keywords' : 'মেইন কিওয়ার্ডস'}
                      </label>
                      <input 
                        type="text" 
                        value={params.primaryKeywords} 
                        onChange={(e) => setParams({...params, primaryKeywords: e.target.value})} 
                        placeholder={params.language === 'en' ? "passport renewal, renewal rules" : "পাসপোর্ট রিন্যু, রিন্যু করার নিয়ম"} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                        <PlusCircle size={14} className="text-indigo-400"/> {params.language === 'en' ? 'Secondary Keywords' : 'সেকেন্ডারি কিওয়ার্ডস'}
                      </label>
                      <input 
                        type="text" 
                        value={params.secondaryKeywords} 
                        onChange={(e) => setParams({...params, secondaryKeywords: e.target.value})} 
                        placeholder={params.language === 'en' ? "application process, documents" : "আবেদন পদ্ধতি, কাগজপত্র"} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                        <Target size={16} className="text-blue-600" /> {params.language === 'en' ? 'Target Audience' : 'টার্গেট অডিয়েন্স'}
                      </label>
                      <input 
                        type="text" 
                        placeholder={params.language === 'en' ? "e.g., Students, Tech lovers" : "উদা: স্টুডেন্ট, টেক লাভার"} 
                        value={params.targetAudience} 
                        onChange={(e) => setParams({...params, targetAudience: e.target.value})} 
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                      />
                    </div>
                  
                    <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                       <div>
                          <label className="block text-xs font-black text-blue-800 uppercase tracking-widest mb-2">{params.language === 'en' ? 'Article Length' : 'আর্টিকেলের দৈর্ঘ্য'}</label>
                          <select value={params.wordCountRange} onChange={(e) => setParams({...params, wordCountRange: e.target.value})} className="w-full px-3 py-2.5 text-sm border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white font-medium">
                            <option value="Short (1000-1200 words)">{params.language === 'en' ? 'Short (1000-1200 words)' : 'ছোট (১০০০-১২০০ শব্দ)'}</option>
                            <option value="Standard (1500-2000 words)">{params.language === 'en' ? 'Standard (1500-2000 words)' : 'মাঝারি (১৫০০-২০০০ শব্দ)'}</option>
                            <option value="Long Form (2500-3500 words)">{params.language === 'en' ? 'Long Form (2500-3500 words)' : 'বড় (২৫০০-৩৫০০ শব্দ)'}</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                             <LayoutList size={16} /> {params.language === 'en' ? 'Custom Outline (Optional)' : 'কাস্টম আউটলাইন (ঐচ্ছিক)'}
                          </label>
                          <textarea 
                             rows={3} 
                             value={params.customOutline} 
                             onChange={(e) => setParams({...params, customOutline: e.target.value})} 
                             placeholder={params.language === 'en' ? "Enter outline..." : "আউটলাইন দিন..."} 
                             className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-y" 
                          />
                       </div>
                       <div>
                          <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                             <MessageSquarePlus size={16} /> {params.language === 'en' ? 'Additional Information' : 'অ্যাডিশনাল ইনফরমেশন'}
                          </label>
                          <textarea 
                             rows={3} 
                             value={params.additionalInfo} 
                             onChange={(e) => setParams({...params, additionalInfo: e.target.value})} 
                             placeholder={params.language === 'en' ? "Other information..." : "অন্য তথ্য..."} 
                             className="w-full px-4 py-3 border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-y" 
                          />
                       </div>
                    </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bold text-gray-700 flex items-center gap-1">
                        <FolderTree size={16} /> {params.language === 'en' ? 'Category' : 'ক্যাটাগরি'}
                      </label>
                      <button 
                        onClick={() => loadCategories(activeSite)}
                        disabled={categoryLoading}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 disabled:opacity-50"
                      >
                        {categoryLoading ? <Loader2 size={12} className="animate-spin" /> : <PlusCircle size={12} />} {params.language === 'en' ? 'Refresh' : 'রিফ্রেশ'}
                      </button>
                    </div>
                    <select 
                      value={selectedCategory} 
                      onChange={(e) => setSelectedCategory(Number(e.target.value))} 
                      className={`w-full px-4 py-3 border ${categoryError ? 'border-red-300' : 'border-gray-200'} rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white`}
                      disabled={categoryLoading}
                    >
                      <option value="">{categoryLoading ? (params.language === 'en' ? 'Loading...' : 'লোড হচ্ছে...') : (params.language === 'en' ? 'Select...' : 'সিলেক্ট করুন...')}</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                    {categoryError && <p className="text-red-500 text-xs mt-1">{categoryError}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                      <ImageIcon size={16} /> {params.language === 'en' ? 'Featured Image' : 'ফিচারড ইমেজ'}
                    </label>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange} />
                    <div className="space-y-3">
                      <div onClick={() => fileInputRef.current?.click()} className="group cursor-pointer border-2 border-dashed border-gray-200 rounded-2xl p-2 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all">
                        {imagePreview ? (
                          <div className="relative">
                             <img src={imagePreview} alt="Preview" className="h-40 w-full object-cover rounded-xl shadow-inner" />
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold rounded-xl transition-opacity text-xs text-center px-2">{params.language === 'en' ? 'Change Image' : 'ছবি পরিবর্তন করুন'}</div>
                          </div>
                        ) : (
                          <div className="py-6 text-gray-400 flex flex-col items-center">
                            <ImageIcon size={32} className="mb-2 opacity-50" />
                            <span className="text-sm font-medium">{params.language === 'en' ? 'Upload SEO Image' : 'এসইও ইমেজ আপলোড'}</span>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={generateAIImage}
                        disabled={isGeneratingImage || !params.primaryKeywords}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                      >
                        {isGeneratingImage ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} {params.language === 'en' ? 'Generate Image with AI' : 'AI দিয়ে ইমেজ জেনারেট করুন'}
                      </button>
                    </div>
                  </div>

                  <button disabled={loading} onClick={handleGenerate} className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-4 rounded-xl font-bold hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? <Loader2 size={24} className="animate-spin" /> : <Target size={24} />} 
                    {loading ? (params.language === 'en' ? 'Generating...' : 'জেনারেট হচ্ছে...') : (params.language === 'en' ? 'Generate Article' : 'আর্টিকেল জেনারেট করুন')}
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              {!article && !loading && (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-gray-400 bg-white border border-gray-100 rounded-3xl shadow-sm px-10">
                  <div className="bg-gray-50 p-6 rounded-full mb-6">
                    <Target size={64} className="opacity-10" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{params.language === 'en' ? 'Article Preview' : 'আর্টিকেল প্রিভিউ'}</h3>
                  <p className="text-center max-w-sm">{params.language === 'en' ? 'Start with keywords on the left. AI will create optimized content for you.' : 'বামে কিওয়ার্ড দিয়ে শুরু করুন। AI আপনার জন্য অপ্টিমাইজড কন্টেন্ট তৈরি করবে।'}</p>
                </div>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-500 min-h-[500px] bg-white rounded-[2.5rem] border border-gray-100 shadow-xl">
                  <div className="relative w-32 h-32 mb-8">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 border-4 border-blue-100 border-t-blue-600 rounded-full"
                    />
                    <motion.div 
                      animate={{ rotate: -360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-4 border-4 border-purple-100 border-t-purple-500 rounded-full"
                    />
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Sparkles size={32} className="text-blue-600" />
                    </motion.div>
                  </div>
                  
                  <div className="text-center space-y-4 max-w-md mx-auto px-4">
                    <motion.h3 
                      key={loadingStep}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-2xl font-black text-gray-900"
                    >
                      {loadingSteps[loadingStep]}
                    </motion.h3>
                    <p className="text-gray-500 text-sm font-medium">
                      {params.language === 'bn' 
                        ? (params.language === 'en' ? 'Our AI is generating the best article for you. This typically takes 30-60 seconds.' : 'আমাদের AI আপনার জন্য একটি সেরা আর্টিকেল তৈরি করছে। এটি সাধারণত ৩০-৬০ সেকেন্ড সময় নিতে পারে।') 
                        : 'Our AI is crafting a high-quality article for you. This usually takes 30-60 seconds.'}
                    </p>
                    
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-6">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ width: `${(loadingStep + 1) * 14.28}%` }}
                        className="h-full bg-gradient-to-r from-blue-600 to-purple-500"
                      />
                    </div>
                    
                    <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">
                      <span>{params.language === 'en' ? 'Start' : 'শুরু'}</span>
                      <span>{params.language === 'en' ? 'Finish' : 'শেষ'}</span>
                    </div>
                  </div>
                </div>
              )}

              {article && !loading && (
                <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                  <div className="flex flex-wrap items-center justify-between gap-4 sticky top-[4.5rem] z-40 bg-white/80 backdrop-blur-xl p-4 sm:p-5 rounded-3xl border border-gray-100 shadow-xl">
                      <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
                        <button disabled={publishLoading} onClick={() => handlePublish(false)} className="flex-1 sm:flex-none bg-green-600 text-white px-4 sm:px-8 py-3 rounded-2xl font-bold hover:bg-green-700 shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 text-sm sm:text-base">
                          {publishLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />} 
                          <span className="hidden xs:inline">{params.language === 'en' ? 'Publish Now' : 'সরাসরি পাবলিশ'}</span>
                          <span className="xs:hidden">{params.language === 'en' ? 'Publish' : 'পাবলিশ'}</span>
                        </button>
                        <button onClick={() => setShowScheduleModal(true)} className="flex-1 sm:flex-none bg-orange-500 text-white px-4 sm:px-8 py-3 rounded-2xl font-bold hover:bg-orange-600 shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 text-sm sm:text-base">
                          <Calendar size={20} /> 
                          <span className="hidden xs:inline">{params.language === 'en' ? 'Schedule' : 'শিডিউল'}</span>
                        </button>
                        <div className="flex items-center gap-2">
                          {copySuccess && (
                            <span className="text-xs text-green-600 font-bold animate-in fade-in slide-in-from-right-2">
                              {params.language === 'en' ? 'Copied!' : 'কপি হয়েছে!'}
                            </span>
                          )}
                          <button onClick={copyToClipboard} className="p-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2" title={params.language === 'en' ? 'Copy content' : 'কপি করুন'}>
                            <FileText size={20} />
                          </button>
                        </div>

                        <button 
                          onClick={() => {
                            if (article) {
                              saveDraftToHistory(article, params);
                              setDraftSavedNotice(true);
                              setTimeout(() => setDraftSavedNotice(false), 2500);
                            }
                          }} 
                          className="p-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-2xl font-bold transition-all flex items-center justify-center gap-1.5" 
                          title={params.language === 'en' ? 'Save as Draft to LocalStorage' : 'লোকালস্টোরেজে ড্রাফট সেভ করুন'}
                        >
                          <Save size={20} />
                          <span className="text-xs font-bold hidden sm:inline">
                            {draftSavedNotice ? (params.language === 'en' ? 'Saved!' : 'ড্রাফট সেভড!') : (params.language === 'en' ? 'Save Draft' : 'ড্রাফট সেভ')}
                          </span>
                        </button>
                        
                        {showArticleClearConfirm ? (
                          <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                            <button 
                              onClick={clearCurrentArticle}
                              className="px-4 py-3 bg-red-600 text-white text-sm font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg"
                            >
                              {params.language === 'en' ? 'Yes' : 'হ্যাঁ'}
                            </button>
                            <button 
                              onClick={() => setShowArticleClearConfirm(false)}
                              className="px-4 py-3 bg-gray-200 text-gray-700 text-sm font-bold rounded-2xl hover:bg-gray-300 transition-all shadow-md"
                            >
                              {params.language === 'en' ? 'No' : 'না'}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setShowArticleClearConfirm(true)} className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all" title={params.language === 'en' ? 'Delete article' : 'মুছে ফেলুন'}>
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    {stats && (
                      <div className="flex flex-wrap gap-3 items-center">
                        <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1"><BarChart3 size={14} /> {stats.wordCount} Words</div>
                        <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1"><Target size={14} /> Density: {stats.density}%</div>
                      </div>
                    )}
                  </div>

                    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-50">
                    {article.outline && (
                      <div className="mb-8 p-6 bg-blue-50/30 rounded-3xl border border-blue-100/50">
                        <p className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest flex items-center gap-2">
                          <LayoutList size={14} /> {params.language === 'en' ? 'Generated Outline (H2)' : 'জেনারেটেড আউটলাইন (H2)'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {article.outline.split(',').map((h2, i) => (
                            <span key={i} className="bg-white px-3 py-1.5 rounded-xl text-xs font-bold text-gray-700 border border-gray-100 shadow-sm">
                              {h2.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {stats && (
                      <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                        <div className="text-center">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Words</p>
                          <p className="text-xl font-black text-gray-900">{stats.wordCount}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Density</p>
                          <p className={`text-xl font-black ${Number(stats.density) >= 1.5 && Number(stats.density) <= 2.5 ? 'text-green-600' : 'text-orange-500'}`}>
                            {stats.density}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Keyword Count</p>
                          <p className="text-xl font-black text-gray-900">{stats.keywordCount}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">SEO Score</p>
                          <p className="text-xl font-black text-green-600">95+</p>
                        </div>
                        <div className="col-span-2 sm:col-span-4 pt-4 border-t border-blue-100 flex flex-wrap gap-4 justify-center">
                          <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.hasInTitle ? 'text-green-600' : 'text-gray-400'}`}>
                            <CheckCircle size={12} /> Keyword in Title
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.inH2Count >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
                            <CheckCircle size={12} /> H2 Optimization ({stats.inH2Count})
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.inH3Count >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
                            <CheckCircle size={12} /> H3 Optimization ({stats.inH3Count})
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-bold ${stats.hasTable ? 'text-green-600' : 'text-gray-400'}`}>
                            <CheckCircle size={12} /> Data Table
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mb-10 pb-8 border-b border-gray-100">
                        <div className="flex items-center gap-2 mb-4 text-xs font-black text-green-600 uppercase tracking-widest"><ShieldCheck size={16} /> Yoast Optimized</div>
                        <div className="group relative">
                          <textarea 
                             value={article.title}
                             onChange={(e) => setArticle({...article, title: e.target.value})}
                             className="w-full text-4xl font-black text-gray-900 mb-8 leading-tight bg-transparent border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-500 focus:ring-0 px-0 py-2 resize-none transition-all placeholder-gray-300"
                             placeholder="Article Title"
                             rows={2}
                          />
                          <Pencil size={16} className="absolute top-4 right-0 text-gray-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
                        </div>
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-6 rounded-3xl border border-gray-200">
                                <p className="text-[10px] font-black text-blue-600 uppercase mb-4 tracking-widest">Snippet Preview & SEO Settings</p>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Focus Keyword</label>
                                        <input 
                                            type="text"
                                            value={article.yoast_seo.focus_keyword}
                                            onChange={(e) => setArticle({...article, yoast_seo: {...article.yoast_seo, focus_keyword: e.target.value}})}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Focus Keyword"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">SEO Title</label>
                                        <input 
                                            type="text"
                                            value={article.yoast_seo.seo_title}
                                            onChange={(e) => setArticle({...article, yoast_seo: {...article.yoast_seo, seo_title: e.target.value}})}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-[#1a0dab] text-lg font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="SEO Title"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Slug</label>
                                        <div className="flex items-center gap-1 text-[#006621] text-sm bg-white px-3 py-2 border border-gray-200 rounded-xl">
                                            <span className="opacity-50">/</span>
                                            <input 
                                                type="text"
                                                value={article.slug}
                                                onChange={(e) => setArticle({...article, slug: e.target.value})}
                                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 outline-none"
                                                placeholder="url-slug"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Meta Description</label>
                                        <textarea 
                                            value={article.yoast_seo.meta_desc}
                                            onChange={(e) => setArticle({...article, yoast_seo: {...article.yoast_seo, meta_desc: e.target.value}})}
                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-[#4d5156] text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                            placeholder="Meta Description"
                                            rows={3}
                                        />
                                        <div className="flex justify-end mt-1">
                                            <span className={`text-[10px] font-bold ${article.yoast_seo.meta_desc.length > 160 ? 'text-red-500' : 'text-gray-400'}`}>
                                                {article.yoast_seo.meta_desc.length} / 160
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* View / Edit Mode Toggle & Article Content */}
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                       <div className="flex items-center gap-2">
                         <button
                           type="button"
                           onClick={() => setArticleViewMode('preview')}
                           className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                             articleViewMode === 'preview' 
                               ? 'bg-blue-600 text-white shadow-sm' 
                               : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                           }`}
                         >
                           <Eye size={14} /> {params.language === 'en' ? 'Formatted Preview' : 'প্রিভিউ'}
                         </button>
                         <button
                           type="button"
                           onClick={() => setArticleViewMode('edit')}
                           className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                             articleViewMode === 'edit' 
                               ? 'bg-blue-600 text-white shadow-sm' 
                               : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                           }`}
                         >
                           <Edit3 size={14} /> {params.language === 'en' ? 'Edit Content (Markdown)' : 'কন্টেন্ট এডিট (Markdown)'}
                         </button>
                       </div>
                       <span className="text-[11px] text-gray-400 font-medium">
                         {articleViewMode === 'edit'
                           ? (params.language === 'en' ? '✓ Changes auto-save to LocalStorage' : '✓ যেকোনো পরিবর্তন সাথে সাথে লোকালস্টোরেজে সেভ হয়')
                           : (params.language === 'en' ? 'Formatted visual preview' : 'হেডিং, টেবিল ও লিস্ট সহ সম্পূর্ণ প্রিভিউ')}
                       </span>
                    </div>

                    {articleViewMode === 'edit' ? (
                      <div className="space-y-3">
                        <textarea
                          rows={24}
                          value={article.content}
                          onChange={(e) => setArticle({ ...article, content: e.target.value })}
                          className="w-full p-5 border border-gray-200 rounded-2xl font-mono text-sm leading-relaxed text-gray-800 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-y transition-all shadow-inner"
                          placeholder={params.language === 'en' ? 'Write or edit markdown content here...' : 'এখানে মার্কডাউন কন্টেন্ট লিখুন বা এডিট করুন...'}
                        />
                      </div>
                    ) : (
                      <div className="space-y-8 text-gray-800 leading-relaxed preview-content prose prose-blue prose-lg max-w-none">
                         <div className="article-body-wrapper" dangerouslySetInnerHTML={{ __html: marked.parse(article.content) }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </main>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
               <h3 className="text-2xl font-black text-gray-900">{params.language === 'en' ? 'Schedule Post' : 'পোস্ট শিডিউল করুন'}</h3>
               <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-900 text-3xl font-light">&times;</button>
            </div>
            <div className="p-8">
              <label className="block text-sm font-bold text-gray-700 mb-4 uppercase tracking-widest text-center">{params.language === 'en' ? 'Schedule Time' : 'শিডিউল সময়'}</label>
              <input type="datetime-local" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full px-5 py-4 border-2 border-gray-100 rounded-2xl mb-8 outline-none focus:border-blue-500 transition-all text-center text-lg font-bold" />
              <div className="flex gap-4">
                <button onClick={() => setShowScheduleModal(false)} className="flex-1 py-4 border rounded-2xl font-bold text-gray-500 hover:bg-gray-50">{params.language === 'en' ? 'Cancel' : 'বাতিল'}</button>
                <button disabled={!scheduleDate || publishLoading} onClick={(e) => {
                  e.stopPropagation();
                  handlePublish(true);
                }} className="flex-1 py-4 bg-orange-500 text-white rounded-2xl font-black hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                  {publishLoading ? <Loader2 className="animate-spin" size={20} /> : <Calendar size={20} />} {params.language === 'en' ? 'Confirm Schedule' : 'শিডিউল নিশ্চিত'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts & History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
                  <History size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    {params.language === 'en' ? 'Saved Drafts & History' : 'সেভড ড্রাফট ও হিস্ট্রি'}
                    <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                      {history.length}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {params.language === 'en' 
                      ? 'All articles are stored permanently in your browser\'s LocalStorage.' 
                      : 'সকল আর্টিকেল আপনার ব্রাউজারের লোকালস্টোরেজে সুরক্ষিত সংরক্ষিত রয়েছে।'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowHistoryModal(false)} 
                className="text-gray-400 hover:text-gray-900 p-2 rounded-xl hover:bg-white/80 transition-all text-2xl font-light leading-none"
              >
                &times;
              </button>
            </div>

            {/* Top Toolbar inside Modal */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={params.language === 'en' ? 'Search by title or keyword...' : 'টাইটেল বা কিওয়ার্ড দিয়ে খুঁজুন...'}
                  className="w-full px-3.5 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportAllDataAsJson}
                  className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  title={params.language === 'en' ? 'Download JSON Backup' : 'JSON ফাইল হিসেবে ব্যাকআপ নিন'}
                >
                  <Download size={14} className="text-blue-600" />
                  <span className="hidden sm:inline">{params.language === 'en' ? 'Export Backup' : 'ব্যাকআপ ডাউনলোড'}</span>
                </button>

                <input 
                  type="file" 
                  ref={backupFileInputRef} 
                  accept=".json" 
                  className="hidden" 
                  onChange={handleImportBackup} 
                />
                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  title={params.language === 'en' ? 'Restore from JSON file' : 'ফাইল থেকে রিস্টোর করুন'}
                >
                  <Upload size={14} className="text-purple-600" />
                  <span className="hidden sm:inline">{params.language === 'en' ? 'Import Backup' : 'ব্যাকআপ ইমপোর্ট'}</span>
                </button>

                {history.length > 0 && (
                  showClearHistoryConfirm ? (
                    <div className="flex items-center gap-1 animate-in fade-in">
                      <button 
                        onClick={clearAllHistory} 
                        className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 shadow-sm"
                      >
                        {params.language === 'en' ? 'Confirm' : 'নিশ্চিত'}
                      </button>
                      <button 
                        onClick={() => setShowClearHistoryConfirm(false)} 
                        className="px-2.5 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300"
                      >
                        {params.language === 'en' ? 'Cancel' : 'বাতিল'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowClearHistoryConfirm(true)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                      title={params.language === 'en' ? 'Clear all drafts' : 'সব ড্রাফট হিস্ট্রি মুছুন'}
                    >
                      <Trash2 size={16} />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Drafts List Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {history.length === 0 ? (
                <div className="text-center py-16 text-gray-400 space-y-3">
                  <div className="bg-gray-50 p-5 rounded-full inline-block">
                    <History size={40} className="text-gray-300" />
                  </div>
                  <h4 className="text-base font-bold text-gray-700">
                    {params.language === 'en' ? 'No Saved Drafts Yet' : 'এখনো কোনো সেভড ড্রাফট নেই'}
                  </h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    {params.language === 'en' 
                      ? 'Whenever an article is generated or saved, it will be kept permanently here in LocalStorage.' 
                      : 'যেকোনো আর্টিকেল জেনারেট করলে বা এডিট করলে স্বয়ংক্রিয়ভাবে লোকালস্টোরেজের এই হিস্ট্রিতে জমা থাকবে।'}
                  </p>
                </div>
              ) : (
                history
                  .filter(item => {
                    if (!historySearch.trim()) return true;
                    const q = historySearch.toLowerCase();
                    return (
                      item.title.toLowerCase().includes(q) ||
                      item.topic.toLowerCase().includes(q) ||
                      item.primaryKeywords.toLowerCase().includes(q)
                    );
                  })
                  .map((draft) => (
                    <div 
                      key={draft.id} 
                      className="p-4 sm:p-5 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                            <Calendar size={11} /> {draft.dateFormatted}
                          </span>
                          <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 flex items-center gap-1">
                            <BarChart3 size={11} /> {draft.wordCount} {params.language === 'en' ? 'words' : 'শব্দ'}
                          </span>
                          {draft.primaryKeywords && (
                            <span className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md font-medium truncate max-w-[180px]">
                              🔑 {draft.primaryKeywords}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-gray-900 truncate" title={draft.title}>
                          {draft.title}
                        </h4>
                        {draft.topic && (
                          <p className="text-xs text-gray-500 truncate">
                            <span className="font-semibold text-gray-700">{params.language === 'en' ? 'Topic: ' : 'টপিক: '}</span>
                            {draft.topic}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <button
                          type="button"
                          onClick={() => restoreDraft(draft)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                        >
                          <RotateCcw size={14} />
                          <span>{params.language === 'en' ? 'Load to Editor' : 'এডিটরে লোড করুন'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDraft(draft.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title={params.language === 'en' ? 'Delete this draft' : 'এই ড্রাফট মুছুন'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-500 shrink-0">
              <span className="flex items-center gap-1.5">
                <HardDrive size={14} className="text-emerald-600" />
                <span>{params.language === 'en' ? 'Permanently stored in browser LocalStorage' : 'ব্রাউজার লোকালস্টোরেজে স্থায়ীভাবে সংরক্ষিত'}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold text-xs transition-all"
              >
                {params.language === 'en' ? 'Close' : 'বন্ধ করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;