import { GenerationParams, GeneratedArticle, CustomAISettings, DEFAULT_AI_SETTINGS } from "../types";

export const DEFAULT_PROMPT_BN = `ROLE: তুমি একজন দক্ষ বাংলা কন্টেন্ট রাইটার এবং এসইও (SEO) বিশেষজ্ঞ। তোমার লক্ষ্য হলো এমন কন্টেন্ট তৈরি করা যা গুগল র‍্যাঙ্কিংয়ে শীর্ষে থাকবে এবং পাঠকদের জন্য অত্যন্ত তথ্যবহুল হবে।

CURRENT DATE CONTEXT: The current year is {currentYear}. 
* CRITICAL: Always use the current year ({currentYear}) for any date-specific information, titles, or meta descriptions. 

SEMANTIC SEO & KEYWORD OPTIMIZATION GUIDELINES:
1. 🎯 PRIMARY KEYWORD: "{primaryKeywords}".
   * Placement: Title, first 100 words (Introduction), at least 3-4 H2 subheadings, and the Conclusion.
   * Density: Maintain a natural density of 1.5% to 2%. Strictly avoid keyword stuffing.
2. 🎯 SECONDARY & LSI KEYWORDS: "{secondaryKeywords}".
   * Use these to build "Topical Authority". Integrate related terms, synonyms, and contextually relevant concepts naturally.
3. 🧠 SEMANTIC WRITING & EXTREME DEPTH: 
   * আর্টিকেলের ডেপথ (Depth) এবং কোয়ালিটি হতে হবে সর্বোচ্চ মানের। 
   * CRITICAL REQUIREMENT: শুধু ভূমিকা নয়, বরং প্রতিটি H2 (##) হেডিংয়ের অধীনে সর্বনিম্ন ১৬০ (160) শব্দের বিস্তারিত আলোচনা থাকতে হবে। 
   * Logical Flow: Ensure a smooth, logical transition between paragraphs and sections.
4. 📊 STRUCTURE & FORMATTING: 
   * Use Markdown headings strictly (## for H2, ### for H3).
   * BREAKDOWN: প্রতিটি H2 (##) সেকশনকে আরও বিস্তারিত করতে তার অধীনে অন্তত ২-৩টি H3 (###) সাব-হেডিং ব্যবহার করতে হবে।
   * CRITICAL PARAGRAPH LENGTH: প্যারাগ্রাফগুলো ছোট হতে হবে (সর্বোচ্চ ৩-৪ লাইন বা sentence)। বড় প্যারাগ্রাফ ভেঙে ছোট ও আকর্ষণীয় করুন।
   * Use Bullet points, Numbered lists, and Tables to break down complex data.

CONTENT ARCHITECTURE (MANDATORY):
* TITLE: Catchy, includes primary keyword and {currentYear}.
* INTRODUCTION: Start with a strong hook. Write at least 150 words explaining what the article covers.
* BODY: Follow the outline. Ensure each section adds unique value and extreme depth.
* FAQ: Include 5-7 "People Also Ask" style questions with detailed answers.
* CONCLUSION: Summarize the key points and end with a strong CTA.

STYLE & TONE:
* LANGUAGE: "Cholit Bhasha" (চলিত ভাষা).
* TONE: Conversational, authoritative, and trustworthy (E-E-A-T). Use ACTIVE VOICE (সক্রিয় বাক্য).
* ENGAGEMENT: Incorporate conversational elements like rhetorical questions (যেমন: 'আপনি কি জানেন?', 'তাহলে উপায় কী?') and natural Bengali idioms (বাগধারা/প্রবাদ) to make the flow engaging and native.
* FORMATTING: **BOLD** the primary and secondary keywords for better visibility.

OUTPUT FORMAT:
Return a STRICT JSON object matching:
{
  "title": "প্রধান শিরোনাম (H1)",
  "outline": "১০-১৩টি H2 হেডিং কমা দিয়ে আলাদা করা",
  "content": "সম্পূর্ণ বিস্তারিত আর্টিকেলের বডি (Markdown ফরম্যাটে)",
  "slug": "bangla-slug-or-english-slug",
  "yoast_seo": {
    "focus_keyword": "{primaryKeywords}",
    "seo_title": "এসইও ফ্রেন্ডলি টাইটেল (৫৫-৬৫ অক্ষর)",
    "meta_desc": "মেটা বিবরণী (১৫০-১৬০ অক্ষর)"
  },
  "image_seo": {
    "alt": "ফিচার্ড ইমেজের অল্টারনেটিভ টেক্সট",
    "caption": "ইমেজের ক্যাপশন"
  },
  "tags": "ট্যাগ১, ট্যাগ২, ট্যাগ৩, ট্যাগ৪, ট্যাগ৫"
}`;

export const DEFAULT_PROMPT_EN = `ROLE: You are an expert copywriter with an Informative tone of voice and Argumentative writing style. Your goal is to write content that ranks at the very top of Google while being incredibly valuable to human readers.

Write as if a human has written this. Do not self-reference. Do not explain what you are doing. The blog article topic is - "{topic}" and KEYWORD is "{primaryKeywords}". 
Write in HTML format only. Mark the title as <h2> in HTML.

FEATURED SNIPPET (AIO):
Your content should directly and clearly answer the user's question. Think of it as providing the most valuable information in a nutshell. While being concise, ensure the information is comprehensive enough to address the query's intent. Get straight to the point and avoid unnecessary fluff. Organize your content using clear headings, bullet points, numbered lists, or tables, depending on the information type. Featured Snippets are typically short, around 40-60 words. The Question is "{primaryKeywords}".

FAQs:
You have an Informative tone of voice. You have an Informative writing style. Generate 6 most frequently asked questions and Answers on the topic "{primaryKeywords}". Start with 2 lines of intro and then Write the questions as headings and then answer them too.

SEMANTIC SEO:
Generate terms for each linguistic term labeled below for the seed keyword, "{primaryKeywords}":
semantically relevant terms, lexical terms, hyponyms, hypernyms, holonyms, meronyms, synonyms, antonyms, collocations, connotations, Etymology, Polysemy, semantical related entities, common attributes, Rare attributes, Unique attributes.
Based on the generated terms and entities, create structured headings (H2 and H3) that are relevant and useful for an in-depth article. Ensure logical flow and hierarchy.

WRITE FULL Humanized BLOG POST:
Write a detailed {wordCountRange} SEO friendly article on the topic "{topic}". Use the terms generated above carefully.

Use the Below Human-Like Writing Techniques:
1. Incorporate Authentic Personal Voice (Use first-person perspective naturally with "I," "we," and "my experience").
2. Vary Sentence Structure and Flow (Mix sentence lengths, use sentence fragments occasionally).
3. Add Imperfections and Irregularities (Include occasional tangents, use parenthetical expressions).
4. Create Depth and Nuance (Present multiple perspectives, acknowledge complexity).
5. Incorporate Industry-Specific Language.
6. Create Conversational Engagement (Address reader directly, use colloquialisms).
7. Demonstrate Critical Thinking.

Avoid AI-like patterns: Predictable structure, generic information, consistent tone perfectly, absolute lack of nuance.

CONTENT STRUCTURE:
1. Write an informational, and easy to read Intro (in four paragraphs).
   - Paragraph 1: Start by introducing the topic.
   - Paragraph 2: Share a personal experience.
   - Paragraph 3: Build anticipation for takeaways.
   - Paragraph 4: Transition smoothly.
   - Do not use: meticulous, navigating, complexities, realm, bespoke, tailored, towards, underpins, everchanging, ever-evolving, not only, seeking more than just, it’s not merely, etc.
2. Write an informational, and easy to read “How to Guide” in the between, where H2 will be the main heading and h3 will be subheadings.
3. Write a detailed Questions and Answer session answering the most asked questions.
4. Write an informational, and easy to read Conclusion.

OUTPUT FORMAT:
Return a STRICT JSON object only. No markdown fences around the json if possible, or use standard \`\`\`json.
Schema:
{
  "title": "Article Title",
  "outline": "10-13 H2 headings, comma-separated",
  "content": "The full HTML article body including Featured Snippet, Intro, How-to, FAQ, and Conclusion",
  "slug": "clean-hyphenated-slug",
  "yoast_seo": {
    "focus_keyword": "{primaryKeywords}",
    "seo_title": "SEO Title (55-65 characters)",
    "meta_desc": "Meta Description (150-160 characters)"
  },
  "image_seo": {
    "alt": "Image Alt text",
    "caption": "Image Caption"
  },
  "tags": "tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8"
}`;

export const fetchAvailableModels = async (): Promise<Array<{ id: string; display_name: string; access_tier?: string }>> => {
  try {
    const res = await fetch("/api/ai-models");
    if (res.ok) {
      const data = await res.json();
      const list = data?.data || data?.models || [];
      return list.map((m: any) => ({
        id: m.id,
        display_name: m.display_name || m.id,
        access_tier: m.access_tier
      }));
    }
  } catch (e) {
    console.warn("Could not fetch models", e);
  }
  return [];
};

export const testAIConnection = async (settings: CustomAISettings): Promise<{ success: boolean; message: string }> => {
  const apiKey = settings.apiKey?.trim();
  if (!apiKey) {
    return {
      success: false,
      message: "API Key খালি রাখা যাবে না। xkiro.com থেকে key কপি করে পেস্ট করুন।"
    };
  }

  const baseUrl = (settings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl).trim();
  const model = (settings.model || DEFAULT_AI_SETTINGS.model).trim();

  try {
    const response = await fetch("/api/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        apiKey,
        model,
        messages: [
          { role: "user", content: "Reply with the single word: OK" }
        ],
        temperature: 0.2,
        max_tokens: 150
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errDetail = data?.error?.message || data?.message || `HTTP ${response.status}`;
      return {
        success: false,
        message: `API সংযোগ ব্যর্থ: ${errDetail}`
      };
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    const notice = data?._fallbackNotice ? ` (${data._fallbackNotice})` : "";
    return {
      success: true,
      message: `সফলভাবে সংযোগ হয়েছে! (Model: ${model}, Response: "${reply.trim()}")${notice}`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `কানেকশন সমস্যা: ${err.message || 'Network error'}`
    };
  }
};

/**
 * Robust JSON repairer and field extractor.
 * Handles unescaped newlines inside strings, missing closing braces, unescaped quotes,
 * and truncated LLM output without throwing fatal errors.
 */
export const robustExtractArticle = (
  rawText: string,
  params: GenerationParams
): GeneratedArticle => {
  // Step 1: Strip thinking tags and markdown fences if any
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Step 2: Try to find JSON block
  const jsonCodeMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  let candidateJson = jsonCodeMatch ? jsonCodeMatch[1].trim() : cleaned;

  // If candidate still has outer text before first { or after last }, slice it
  const firstBrace = candidateJson.indexOf("{");
  if (firstBrace !== -1) {
    const lastBrace = candidateJson.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      candidateJson = candidateJson.substring(firstBrace, lastBrace + 1);
    } else {
      // Missing closing brace (truncated)
      candidateJson = candidateJson.substring(firstBrace);
    }
  }

  // Attempt A: Direct parse
  try {
    const direct = JSON.parse(candidateJson);
    if (direct && (direct.content || direct.title)) {
      return buildArticle(direct, params);
    }
  } catch {
    // Continue to repair
  }

  // Attempt B: Repair unescaped newlines and control characters inside JSON strings
  try {
    const repaired = repairJsonString(candidateJson);
    const parsed = JSON.parse(repaired);
    if (parsed && (parsed.content || parsed.title)) {
      return buildArticle(parsed, params);
    }
  } catch {
    // Continue to resilient field extraction
  }

  // Attempt C: Resilient regex-based field extractor (100% resilient even with truncated or malformed JSON)
  return extractFieldsResiliently(cleaned, params);
};

/**
 * Walks JSON string character-by-character, converting raw newlines, carriage returns,
 * and control characters inside strings into valid escape sequences, and closes open quotes/braces.
 */
function repairJsonString(input: string): string {
  let output = "";
  let inString = false;
  let isEscaped = false;
  let openBraces = 0;
  let openBrackets = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (isEscaped) {
      output += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      output += char;
      isEscaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      output += char;
      continue;
    }

    if (inString) {
      if (char === "\n") {
        output += "\\n";
      } else if (char === "\r") {
        output += "\\r";
      } else if (char === "\t") {
        output += "\\t";
      } else if (char.charCodeAt(0) < 32) {
        // Drop any other bad control characters
      } else {
        output += char;
      }
    } else {
      if (char === "{") openBraces++;
      else if (char === "}") openBraces--;
      else if (char === "[") openBrackets++;
      else if (char === "]") openBrackets--;
      output += char;
    }
  }

  // Auto-close if truncated mid-string
  if (inString) {
    output += '"';
  }
  // Auto-close open brackets
  while (openBrackets > 0) {
    output += "]";
    openBrackets--;
  }
  // Auto-close open braces
  while (openBraces > 0) {
    output += "}";
    openBraces--;
  }

  // Clean trailing commas before } or ]
  output = output.replace(/,\s*([}\]])/g, "$1");

  return output;
}

/**
 * Extracts fields using pattern matching when JSON structure is heavily broken or truncated.
 */
function extractFieldsResiliently(raw: string, params: GenerationParams): GeneratedArticle {
  const currentYear = new Date().getFullYear();

  // 1. Title extraction
  let title = "";
  const titleMatch = raw.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (titleMatch) {
    title = cleanEscapes(titleMatch[1]);
  } else {
    // Look for markdown heading H1 if not in JSON
    const h1Match = raw.match(/^#\s+(.+)$/m);
    if (h1Match) {
      title = h1Match[1].trim();
    } else {
      title = params.topic || "Untitled Article";
    }
  }

  // 2. Outline extraction
  let outline = "";
  const outlineMatch = raw.match(/"outline"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (outlineMatch) {
    outline = cleanEscapes(outlineMatch[1]);
  }

  // 3. Content extraction
  let content = "";
  // Look for "content": "..."
  const contentIdx = raw.search(/"content"\s*:\s*"/);
  if (contentIdx !== -1) {
    const afterQuoteIdx = raw.indexOf('"', contentIdx + 10) + 1;
    // Find where content ends: usually before next top-level key or end of JSON
    const nextKeyMatch = raw.slice(afterQuoteIdx).match(/",\s*"(?:slug|yoast_seo|image_seo|tags)"/);
    if (nextKeyMatch && nextKeyMatch.index !== undefined) {
      content = raw.slice(afterQuoteIdx, afterQuoteIdx + nextKeyMatch.index);
    } else {
      // Check for closing quote followed by closing brace
      const endBraceIdx = raw.lastIndexOf('}');
      const endQuoteIdx = raw.lastIndexOf('"', endBraceIdx > 0 ? endBraceIdx - 1 : raw.length - 1);
      if (endQuoteIdx > afterQuoteIdx) {
        content = raw.slice(afterQuoteIdx, endQuoteIdx);
      } else {
        // Output was truncated mid-content! Take everything till end
        content = raw.slice(afterQuoteIdx);
      }
    }
    content = cleanEscapes(content);
  }

  // If content still empty or too short, check if raw string itself is markdown
  if (!content || content.length < 100) {
    // If the entire text contains markdown headers, use the raw markdown
    const mdStart = raw.indexOf("# ");
    if (mdStart !== -1) {
      content = raw.substring(mdStart).replace(/```\s*$/g, "").trim();
    } else if (raw.includes("## ")) {
      content = raw.substring(raw.indexOf("## ")).replace(/```\s*$/g, "").trim();
    } else {
      content = raw;
    }
  }

  // 4. Slug extraction
  let slug = "";
  const slugMatch = raw.match(/"slug"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (slugMatch) {
    slug = cleanEscapes(slugMatch[1]);
  } else {
    slug = (params.topic || "article").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // 5. Yoast SEO extraction
  let focusKeyword = params.primaryKeywords;
  let seoTitle = title;
  let metaDesc = "";

  const focusMatch = raw.match(/"focus_keyword"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (focusMatch) focusKeyword = cleanEscapes(focusMatch[1]);

  const seoTitleMatch = raw.match(/"seo_title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (seoTitleMatch) seoTitle = cleanEscapes(seoTitleMatch[1]);

  const metaDescMatch = raw.match(/"meta_desc"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (metaDescMatch) metaDesc = cleanEscapes(metaDescMatch[1]);
  else {
    // Generate a fallback meta description from intro
    metaDesc = `${title} সম্পর্কে বিস্তারিত জেনে নিন। ${focusKeyword} সম্পর্কিত প্রয়োজনীয় সকল তথ্য এখানে ধাপে ধাপে আলোচনা করা হয়েছে।`;
  }

  // 6. Image SEO
  let imageAlt = params.primaryKeywords;
  let imageCaption = params.primaryKeywords;

  const altMatch = raw.match(/"alt"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (altMatch) imageAlt = cleanEscapes(altMatch[1]);

  const capMatch = raw.match(/"caption"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (capMatch) imageCaption = cleanEscapes(capMatch[1]);

  // 7. Tags
  let tags = params.primaryKeywords;
  const tagsMatch = raw.match(/"tags"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (tagsMatch) tags = cleanEscapes(tagsMatch[1]);

  return {
    title: title || params.topic,
    outline: outline,
    content: content,
    slug: slug,
    yoast_seo: {
      focus_keyword: focusKeyword,
      seo_title: seoTitle,
      meta_desc: metaDesc
    },
    image_seo: {
      alt: imageAlt,
      caption: imageCaption
    },
    tags: tags
  };
}

function cleanEscapes(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function buildArticle(parsed: any, params: GenerationParams): GeneratedArticle {
  const title = parsed.title || params.topic;
  return {
    title: title,
    outline: parsed.outline || "",
    content: parsed.content || "",
    slug: parsed.slug || (params.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
    yoast_seo: {
      focus_keyword: parsed.yoast_seo?.focus_keyword || parsed.focus_keyword || params.primaryKeywords,
      seo_title: parsed.yoast_seo?.seo_title || parsed.seo_title || title,
      meta_desc: parsed.yoast_seo?.meta_desc || parsed.meta_desc || ""
    },
    image_seo: {
      alt: parsed.image_seo?.alt || parsed.image_alt || params.primaryKeywords,
      caption: parsed.image_seo?.caption || parsed.image_caption || params.primaryKeywords
    },
    tags: parsed.tags || params.primaryKeywords
  };
}

export const generateSEOArticle = async (
  params: GenerationParams, 
  customSettings?: CustomAISettings
): Promise<GeneratedArticle> => {
  // Retrieve settings
  let settings = customSettings;
  if (!settings || !settings.apiKey) {
    try {
      const saved = localStorage.getItem("custom_ai_settings");
      if (saved) {
        settings = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Could not read custom_ai_settings from localStorage", e);
    }
  }

  const apiKey = settings?.apiKey?.trim();
  if (!apiKey) {
    throw new Error(
      params.language === 'en'
        ? "xKiro API Key is missing. Please go to Settings and enter your API Key from xkiro.com."
        : "xKiro API Key পাওয়া যায়নি। অনুগ্রহ করে সেটিংস পেজে গিয়ে xkiro.com-এর ড্যাশবোর্ড থেকে API Key যুক্ত করুন।"
    );
  }

  const baseUrl = (settings?.baseUrl || DEFAULT_AI_SETTINGS.baseUrl).trim();
  const model = (settings?.model || DEFAULT_AI_SETTINGS.model).trim();
  const currentYear = new Date().getFullYear();
  const isEn = params.language === 'en';

  const replaceVariables = (templateStr: string): string => {
    return templateStr
      .replace(/\{topic\}/gi, params.topic)
      .replace(/\{primaryKeywords\}/gi, params.primaryKeywords)
      .replace(/\{secondaryKeywords\}/gi, params.secondaryKeywords)
      .replace(/\{wordCountRange\}/gi, params.wordCountRange || "1500-2000 words")
      .replace(/\{targetAudience\}/gi, params.targetAudience || "")
      .replace(/\{customOutline\}/gi, params.customOutline || "")
      .replace(/\{additionalInfo\}/gi, params.additionalInfo || "")
      .replace(/\{currentYear\}/gi, String(currentYear));
  };

  let systemInstruction = "";

  if (isEn) {
    if (settings?.customPromptEn && settings.customPromptEn.trim().length > 10) {
      systemInstruction = replaceVariables(settings.customPromptEn.trim());
    } else {
      systemInstruction = replaceVariables(DEFAULT_PROMPT_EN);
    }
  } else {
    if (settings?.customPromptBn && settings.customPromptBn.trim().length > 10) {
      systemInstruction = replaceVariables(settings.customPromptBn.trim());
    } else {
      systemInstruction = replaceVariables(DEFAULT_PROMPT_BN);
    }
  }

  const prompt = `
Topic: ${params.topic}
Main Keywords: ${params.primaryKeywords}
Secondary Keywords: ${params.secondaryKeywords || "None"}
Target Word Count: ${params.wordCountRange || "Standard"}
Target Audience: ${params.targetAudience || "General Readers"}
Custom Outline: ${params.customOutline || "None provided."}
Additional Info: ${params.additionalInfo || "None provided."}

Generate a comprehensive, high-quality, full-length content in ${isEn ? 'English' : 'Bengali'} strictly adhering to all system instructions and guidelines above.
CRITICAL FORMATTING INSTRUCTIONS:
1. Respond ONLY with a valid JSON object matching the output schema.
2. In the "content" field, write the complete, thorough, long-form article.
3. Escape all quotes inside strings properly (e.g. \\") and use \\n for newlines so the output is strictly valid JSON.
  `.trim();

  const messages = [
    {
      role: "system",
      content: `${systemInstruction}\n\nIMPORTANT: You must output ONLY a valid JSON object. No preambles, no conversational filler, and no closing remarks.`
    },
    {
      role: "user",
      content: prompt
    }
  ];

  try {
    const response = await fetch("/api/ai-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        apiKey,
        model,
        messages,
        temperature: 0.7,
        max_tokens: 8192
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.message || `HTTP ${response.status}`;
      throw new Error(`AI API Error: ${errMsg}`);
    }

    const rawContent = data?.choices?.[0]?.message?.content || "";
    if (!rawContent) {
      throw new Error("AI did not return any content. Please check the model name and quota.");
    }

    // Use our resilient extractor
    const article = robustExtractArticle(rawContent, params);

    // If article content is empty, throw informative error
    if (!article.content || article.content.trim().length === 0) {
      throw new Error(
        isEn
          ? "The AI response did not contain article content. Please try again."
          : "AI থেকে আর্টিকেলের মূল বক্তব্য পাওয়া যায়নি। দয়া করে আবার চেষ্টা করুন।"
      );
    }

    return article;
  } catch (err: any) {
    console.error("AI Generation Error:", err);
    throw err;
  }
};
