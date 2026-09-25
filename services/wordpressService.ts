import { WPSettings, WPPostResponse, WPCategory, WPSite } from "../types";

const getBaseUrl = (url: string) => url.endsWith('/') ? url.slice(0, -1) : url;

// Safe utf-8 compatible Base64 encoder for browser
const getBasicAuthHeader = (username: string, appPassword: string): string => {
  const cleanUsername = username.trim();
  const cleanPassword = appPassword.replace(/\s+/g, ' ').trim();
  try {
    return `Basic ${btoa(unescape(encodeURIComponent(`${cleanUsername}:${cleanPassword}`)))}`;
  } catch (e) {
    return `Basic ${btoa(`${cleanUsername}:${cleanPassword}`)}`;
  }
};

/**
 * Direct WordPress REST API request from client-side browser
 */
const wpRequest = async (site: WPSite, path: string, method: string = 'GET', data?: any, params?: any) => {
  const baseUrl = getBaseUrl(site.url);
  let fullUrl = `${baseUrl}${path}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        searchParams.append(k, String(v));
      }
    }
    const sep = fullUrl.includes('?') ? '&' : '?';
    fullUrl = `${fullUrl}${sep}${searchParams.toString()}`;
  }

  const authHeader = getBasicAuthHeader(site.username, site.appPassword);
  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'Accept': 'application/json'
  };

  const reqInit: RequestInit = {
    method,
    headers
  };

  if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    headers['Content-Type'] = 'application/json';
    reqInit.body = JSON.stringify(data);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, reqInit);
  } catch (netErr: any) {
    console.error("WordPress Direct Request Network/CORS Error:", netErr);
    throw new Error(
      `WordPress-এ কানেক্ট করা যাচ্ছে না (${netErr.message || 'CORS / Network Error'})। আপনার ওয়ার্ডপ্রেস সাইটটি ব্রাউজার থেকে সরাসরি রিকোয়েস্ট ব্লক করছে। দয়া করে ওয়ার্ডপ্রেস সাইটের functions.php-তে CORS হেডার অ্যালাউ করুন অথবা Cloudflare/Wordfence-এ REST API এক্সেস দিন।`
    );
  }

  const responseText = await response.text();
  
  let responseData: any;
  try {
    responseData = responseText ? JSON.parse(responseText) : null;
  } catch (e) {
    responseData = null;
  }

  if (!responseData && typeof responseText === 'string') {
    if (responseText.includes('<title>Cookie check</title>') || responseText.includes('Wordfence') || responseText.includes('cloudflare')) {
      throw new Error("আপনার ওয়েবসাইটের সিকিউরিটি প্লাগিন (যেমন: Wordfence বা Cloudflare) API রিকোয়েস্ট ব্লক করছে। দয়া করে প্লাগিন সেটিংসে REST API বা এই অ্যাপের অ্যাক্সেস অ্যালাউ করুন।");
    }
  }

  if (!response.ok) {
    let errorMsg = responseData?.message || `WordPress API failed: ${response.statusText} (${response.status})`;
    const errorCode = responseData?.code || 'unknown_error';
    
    if (response.status === 401 || response.status === 403) {
      errorMsg = `পাবলিশ করতে সমস্যা হচ্ছে (Permission Denied: HTTP ${response.status})। আপনার ওয়ার্ডপ্রেস ইউজার রোল (Editor/Admin) এবং Application Password চেক করুন।`;
    } else if (response.status === 400) {
      errorMsg = `পাবলিশ করতে সমস্যা হচ্ছে (Bad Request: ${errorCode})। ${responseData?.message || ''}`;
    }

    const error = new Error(errorMsg) as any;
    error.status = response.status;
    error.code = errorCode;
    error.data = responseData;
    
    if (!responseData) {
      console.error("Non-JSON error response:", responseText);
    }
    throw error;
  }

  if (responseData) {
    return responseData;
  } else if (responseText.trim() === "") {
    return {};
  } else {
    console.error("Expected JSON but got:", responseText);
    throw new Error("সার্ভার থেকে সঠিক ফরম্যাটে উত্তর পাওয়া যায়নি (Expected JSON)।");
  }
};

export const fetchCategories = async (site: WPSite): Promise<WPCategory[]> => {
  return wpRequest(site, '/wp-json/wp/v2/categories?per_page=100');
};

export const fetchRecentPostsByCategory = async (site: WPSite, categoryId: number, count: number = 2): Promise<{title: string, link: string}[]> => {
  const posts = await wpRequest(site, `/wp-json/wp/v2/posts?categories=${categoryId}&per_page=${count}&status=publish`);
  if (!Array.isArray(posts)) return [];
  return posts.map((p: any) => ({
    title: p.title?.rendered || '',
    link: p.link || ''
  }));
};

export interface MediaMetadata {
  title: string;
  alt_text: string;
  caption: string;
  description: string;
}

/**
 * Direct client-side WordPress Media Upload using FormData
 */
export const uploadMedia = async (site: WPSite, file: File, metadata: MediaMetadata): Promise<number> => {
  const baseUrl = getBaseUrl(site.url);
  const mediaUrl = `${baseUrl}/wp-json/wp/v2/media`;

  const authHeader = getBasicAuthHeader(site.username, site.appPassword);

  const formData = new FormData();
  formData.append('file', file, file.name);
  if (metadata.title) formData.append('title', metadata.title);
  if (metadata.alt_text) formData.append('alt_text', metadata.alt_text);
  if (metadata.caption) formData.append('caption', metadata.caption);
  if (metadata.description) formData.append('description', metadata.description);

  let response: Response;
  try {
    response = await fetch(mediaUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
        // Browser sets Content-Type multipart boundary automatically
      },
      body: formData
    });
  } catch (netErr: any) {
    console.error("WP Media Upload Network/CORS Error:", netErr);
    throw new Error(
      `ইমেজ আপলোড করতে সমস্যা হয়েছে (${netErr.message || 'CORS / Network Error'})। আপনার ওয়ার্ডপ্রেস সাইট সম্ভবত ব্রাউজার থেকে ফাইল আপলোড ব্লক করছে।`
    );
  }

  const responseText = await response.text();

  let responseData: any;
  try {
    responseData = responseText ? JSON.parse(responseText) : null;
  } catch (e) {
    responseData = null;
  }

  if (!responseData && typeof responseText === 'string') {
    if (responseText.includes('<title>Cookie check</title>') || responseText.includes('Wordfence') || responseText.includes('cloudflare')) {
      throw new Error("আপনার ওয়েবসাইটের সিকিউরিটি প্লাগিন (যেমন: Wordfence বা Cloudflare) মিডিয়া আপলোড ব্লক করছে।");
    }
  }

  if (!response.ok) {
    let errorMsg = responseData?.message || `Media upload failed (Status: ${response.status})`;
    if (!responseData && (responseText.includes('<!doctype') || responseText.includes('<html'))) {
      errorMsg = "আপনার ওয়ার্ডপ্রেস সাইট থেকে ডেটার বদলে একটি এইচটিএমএল পেজ এসেছে। এটি সাধারণত সিকিউরিটি প্লাগিন বা ভুল ইউআরএল-এর কারণে হয়।";
    }
    throw new Error(errorMsg);
  }

  if (responseData && responseData.id) {
    return responseData.id;
  } else {
    console.error("Failed to parse media upload response as JSON. Content:", responseText);
    throw new Error("ইমেজ আপলোডের সঠিক রেসপন্স পাওয়া যায়নি।");
  }
};

export const ensureTags = async (site: WPSite, tags: string[]): Promise<number[]> => {
  const tagIds: number[] = [];

  for (const tagName of tags) {
    try {
      const data = await wpRequest(site, '/wp-json/wp/v2/tags', 'POST', { name: tagName });
      tagIds.push(data.id);
    } catch (e: any) {
      if (e.code === 'term_exists') {
        // Tag already exists, try to find its ID
        try {
          const existingTags = await wpRequest(site, `/wp-json/wp/v2/tags?search=${encodeURIComponent(tagName)}`);
          const exactMatch = existingTags.find((t: any) => t.name.toLowerCase() === tagName.toLowerCase());
          if (exactMatch) {
            tagIds.push(exactMatch.id);
            continue;
          }
        } catch (searchErr) {
          console.error(`Failed to search for existing tag: ${tagName}`, searchErr);
        }
      }
      console.warn(`Could not handle tag: ${tagName}`, e);
    }
  }
  return tagIds;
};

const sanitizeSlug = (slug: string) => {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric except spaces and hyphens
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single one
    .substring(0, 150); // Truncate to safe length
};

export const publishToWP = async (
  site: WPSite,
  article: { 
    title: string; 
    content: string; 
    slug: string; 
    date?: string; 
    category?: number;
    tags?: number[];
    metaDescription: string;
    focusKeyword: string;
    seoTitle: string;
    featuredMediaId?: number;
  }
): Promise<WPPostResponse> => {
  const body: any = {
    title: article.title,
    content: article.content,
    slug: sanitizeSlug(article.slug),
    status: article.date ? 'future' : 'publish',
    excerpt: article.metaDescription ? article.metaDescription.substring(0, 500) : '',
    meta: {
      // Yoast SEO (Standard keys)
      _yoast_wpseo_focuskw: article.focusKeyword,
      _yoast_wpseo_title: article.seoTitle,
      _yoast_wpseo_metadesc: article.metaDescription,
      
      // Yoast SEO (Alternative keys sometimes used by REST API extensions)
      yoast_wpseo_focuskw: article.focusKeyword,
      yoast_wpseo_title: article.seoTitle,
      yoast_wpseo_metadesc: article.metaDescription,

      // Open Graph (Yoast)
      _yoast_wpseo_opengraph_title: article.seoTitle,
      _yoast_wpseo_opengraph_description: article.metaDescription,
      _yoast_wpseo_twitter_title: article.seoTitle,
      _yoast_wpseo_twitter_description: article.metaDescription,
      
      // RankMath SEO
      rank_math_focus_keyword: article.focusKeyword,
      rank_math_title: article.seoTitle,
      rank_math_description: article.metaDescription,
      rank_math_facebook_title: article.seoTitle,
      rank_math_facebook_description: article.metaDescription
    }
  };

  if (article.date) body.date = article.date;
  if (article.category) body.categories = [article.category];
  if (article.tags && article.tags.length > 0) body.tags = article.tags;
  if (article.featuredMediaId) body.featured_media = article.featuredMediaId;

  const data = await wpRequest(site, '/wp-json/wp/v2/posts', 'POST', body);

  return {
    link: data.link,
    id: data.id
  };
};
