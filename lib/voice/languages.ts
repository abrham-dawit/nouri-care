/**
 * Languages and accents Nouri can be configured for.
 *
 * Honesty notes:
 * - `textQuality` is an ESTIMATE of how well current AI models write in a
 *   language. It has not been evaluated with native speakers. Low-resource
 *   languages (e.g. Tigrinya) are expected to be noticeably weaker.
 * - Speech depends on the voices installed on the device (detected at runtime);
 *   many languages have no installed voice on a typical computer.
 * - All non-English sample phrases and safety messages below were drafted
 *   without native-speaker review and must be checked before real-world use.
 */

export type TextQuality = "strong" | "fair" | "limited";

export type Region = { code: string; name: string; /** Dialect hint for the model, if different from the standard. */ dialect?: string };

export type Language = {
  code: string;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  textQuality: TextQuality;
  regions: Region[];
};

type Row = [code: string, name: string, nativeName: string, rtl?: boolean];

// prettier-ignore
const ROWS: Row[] = [
  ["af", "Afrikaans", "Afrikaans"], ["ak", "Akan (Twi)", "Akan"], ["sq", "Albanian", "Shqip"], ["am", "Amharic", "አማርኛ"],
  ["ar", "Arabic", "العربية", true], ["hy", "Armenian", "Հայերեն"], ["as", "Assamese", "অসমীয়া"], ["ay", "Aymara", "Aymar aru"],
  ["az", "Azerbaijani", "Azərbaycan dili"], ["bm", "Bambara", "Bamanankan"], ["eu", "Basque", "Euskara"], ["be", "Belarusian", "Беларуская"],
  ["bn", "Bengali", "বাংলা"], ["bho", "Bhojpuri", "भोजपुरी"], ["bs", "Bosnian", "Bosanski"], ["bg", "Bulgarian", "Български"],
  ["my", "Burmese", "မြန်မာ"], ["yue", "Cantonese", "粵語"], ["ca", "Catalan", "Català"], ["ceb", "Cebuano", "Cebuano"],
  ["ny", "Chichewa", "Chichewa"], ["zh", "Chinese (Mandarin)", "中文"], ["co", "Corsican", "Corsu"], ["hr", "Croatian", "Hrvatski"],
  ["cs", "Czech", "Čeština"], ["da", "Danish", "Dansk"], ["dv", "Dhivehi", "ދިވެހި", true], ["nl", "Dutch", "Nederlands"],
  ["en", "English", "English"], ["eo", "Esperanto", "Esperanto"], ["et", "Estonian", "Eesti"], ["ee", "Ewe", "Eʋegbe"],
  ["fil", "Filipino", "Filipino"], ["fi", "Finnish", "Suomi"], ["fr", "French", "Français"], ["fy", "Frisian", "Frysk"],
  ["ff", "Fula", "Fulfulde"], ["gl", "Galician", "Galego"], ["lg", "Ganda (Luganda)", "Luganda"], ["ka", "Georgian", "ქართული"],
  ["de", "German", "Deutsch"], ["el", "Greek", "Ελληνικά"], ["gn", "Guarani", "Avañeʼẽ"], ["gu", "Gujarati", "ગુજરાતી"],
  ["ht", "Haitian Creole", "Kreyòl ayisyen"], ["ha", "Hausa", "Hausa"], ["haw", "Hawaiian", "ʻŌlelo Hawaiʻi"], ["he", "Hebrew", "עברית", true],
  ["hi", "Hindi", "हिन्दी"], ["hmn", "Hmong", "Hmoob"], ["hu", "Hungarian", "Magyar"], ["is", "Icelandic", "Íslenska"],
  ["ig", "Igbo", "Igbo"], ["ilo", "Ilocano", "Ilokano"], ["id", "Indonesian", "Bahasa Indonesia"], ["ga", "Irish", "Gaeilge"],
  ["it", "Italian", "Italiano"], ["ja", "Japanese", "日本語"], ["jv", "Javanese", "Basa Jawa"], ["kn", "Kannada", "ಕನ್ನಡ"],
  ["kk", "Kazakh", "Қазақ тілі"], ["km", "Khmer", "ខ្មែរ"], ["rw", "Kinyarwanda", "Ikinyarwanda"], ["ko", "Korean", "한국어"],
  ["ku", "Kurdish (Kurmanji)", "Kurdî"], ["ckb", "Kurdish (Sorani)", "کوردی", true], ["ky", "Kyrgyz", "Кыргызча"], ["lo", "Lao", "ລາວ"],
  ["la", "Latin", "Latina"], ["lv", "Latvian", "Latviešu"], ["ln", "Lingala", "Lingála"], ["lt", "Lithuanian", "Lietuvių"],
  ["lb", "Luxembourgish", "Lëtzebuergesch"], ["mk", "Macedonian", "Македонски"], ["mai", "Maithili", "मैथिली"], ["mg", "Malagasy", "Malagasy"],
  ["ms", "Malay", "Bahasa Melayu"], ["ml", "Malayalam", "മലയാളം"], ["mt", "Maltese", "Malti"], ["mi", "Māori", "Te Reo Māori"],
  ["mr", "Marathi", "मराठी"], ["mn", "Mongolian", "Монгол"], ["ne", "Nepali", "नेपाली"], ["no", "Norwegian", "Norsk"],
  ["or", "Odia", "ଓଡ଼ିଆ"], ["om", "Oromo", "Afaan Oromoo"], ["ps", "Pashto", "پښتو", true], ["fa", "Persian", "فارسی", true],
  ["pl", "Polish", "Polski"], ["pt", "Portuguese", "Português"], ["pa", "Punjabi", "ਪੰਜਾਬੀ"], ["qu", "Quechua", "Runa Simi"],
  ["ro", "Romanian", "Română"], ["ru", "Russian", "Русский"], ["sm", "Samoan", "Gagana Samoa"], ["sa", "Sanskrit", "संस्कृतम्"],
  ["gd", "Scottish Gaelic", "Gàidhlig"], ["sr", "Serbian", "Српски"], ["st", "Sesotho", "Sesotho"], ["sn", "Shona", "chiShona"],
  ["sd", "Sindhi", "سنڌي", true], ["si", "Sinhala", "සිංහල"], ["sk", "Slovak", "Slovenčina"], ["sl", "Slovenian", "Slovenščina"],
  ["so", "Somali", "Soomaali"], ["es", "Spanish", "Español"], ["su", "Sundanese", "Basa Sunda"], ["sw", "Swahili", "Kiswahili"],
  ["sv", "Swedish", "Svenska"], ["tg", "Tajik", "Тоҷикӣ"], ["ta", "Tamil", "தமிழ்"], ["tt", "Tatar", "Татар"],
  ["te", "Telugu", "తెలుగు"], ["th", "Thai", "ไทย"], ["ti", "Tigrinya", "ትግርኛ"], ["ts", "Tsonga", "Xitsonga"],
  ["tn", "Tswana", "Setswana"], ["tr", "Turkish", "Türkçe"], ["tk", "Turkmen", "Türkmençe"], ["uk", "Ukrainian", "Українська"],
  ["ur", "Urdu", "اردو", true], ["ug", "Uyghur", "ئۇيغۇرچە", true], ["uz", "Uzbek", "Oʻzbek"], ["vi", "Vietnamese", "Tiếng Việt"],
  ["cy", "Welsh", "Cymraeg"], ["wo", "Wolof", "Wolof"], ["xh", "Xhosa", "isiXhosa"], ["yi", "Yiddish", "ייִדיש", true],
  ["yo", "Yoruba", "Yorùbá"], ["zu", "Zulu", "isiZulu"],
];

// prettier-ignore
const STRONG = new Set(["en", "es", "fr", "de", "it", "pt", "nl", "zh", "ja", "ko", "ru", "ar", "hi", "tr", "pl", "sv", "da", "no", "fi", "cs", "el", "he", "id", "vi", "th", "uk", "ro", "hu", "ca", "bg", "hr", "sk", "sl", "sr", "ms", "fil", "bn", "fa", "ur", "ta", "te", "mr", "gu", "kn", "ml", "sw", "lt", "lv", "et"]);
// prettier-ignore
const LIMITED = new Set(["ti", "ak", "ln", "wo", "ff", "bm", "lg", "ee", "gn", "ay", "ilo", "bho", "mai", "sa", "dv", "ts", "tn", "om", "qu", "hmn"]);

// prettier-ignore
const REGIONS: Record<string, Region[]> = {
  en: [
    { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" }, { code: "AU", name: "Australia" },
    { code: "CA", name: "Canada" }, { code: "IE", name: "Ireland" }, { code: "IN", name: "India" }, { code: "NG", name: "Nigeria" },
    { code: "KE", name: "Kenya" }, { code: "ZA", name: "South Africa" }, { code: "NZ", name: "New Zealand" },
  ],
  es: [
    { code: "MX", name: "Mexico", dialect: "Mexican Spanish" }, { code: "US", name: "United States", dialect: "US Spanish" },
    { code: "ES", name: "Spain", dialect: "Castilian Spanish" }, { code: "AR", name: "Argentina", dialect: "Rioplatense Spanish" },
    { code: "CO", name: "Colombia", dialect: "Colombian Spanish" }, { code: "PE", name: "Peru" }, { code: "CL", name: "Chile" },
  ],
  ar: [
    { code: "SA", name: "Saudi Arabia", dialect: "Modern Standard Arabic with a Gulf tone" }, { code: "EG", name: "Egypt", dialect: "Egyptian Arabic" },
    { code: "JO", name: "Jordan", dialect: "Levantine Arabic" }, { code: "LB", name: "Lebanon", dialect: "Levantine Arabic" },
    { code: "AE", name: "United Arab Emirates", dialect: "Gulf Arabic" }, { code: "MA", name: "Morocco", dialect: "Moroccan Arabic (Darija)" },
    { code: "IQ", name: "Iraq", dialect: "Iraqi Arabic" }, { code: "SD", name: "Sudan", dialect: "Sudanese Arabic" },
  ],
  am: [{ code: "ET", name: "Ethiopia" }],
  ti: [{ code: "ER", name: "Eritrea" }, { code: "ET", name: "Ethiopia (Tigray)" }],
  om: [{ code: "ET", name: "Ethiopia" }],
  so: [{ code: "SO", name: "Somalia" }, { code: "ET", name: "Ethiopia" }, { code: "KE", name: "Kenya" }],
  sw: [{ code: "KE", name: "Kenya" }, { code: "TZ", name: "Tanzania" }],
  fr: [{ code: "FR", name: "France" }, { code: "CA", name: "Canada", dialect: "Québécois French" }, { code: "BE", name: "Belgium" }, { code: "CH", name: "Switzerland" }, { code: "SN", name: "Senegal" }],
  pt: [{ code: "BR", name: "Brazil", dialect: "Brazilian Portuguese" }, { code: "PT", name: "Portugal", dialect: "European Portuguese" }],
  zh: [{ code: "CN", name: "Mainland China", dialect: "Simplified Chinese" }, { code: "TW", name: "Taiwan", dialect: "Traditional Chinese" }],
  yue: [{ code: "HK", name: "Hong Kong" }],
  de: [{ code: "DE", name: "Germany" }, { code: "AT", name: "Austria" }, { code: "CH", name: "Switzerland" }],
  it: [{ code: "IT", name: "Italy" }],
  nl: [{ code: "NL", name: "Netherlands" }, { code: "BE", name: "Belgium (Flemish)" }],
  hi: [{ code: "IN", name: "India" }],
  ur: [{ code: "PK", name: "Pakistan" }, { code: "IN", name: "India" }],
  bn: [{ code: "BD", name: "Bangladesh" }, { code: "IN", name: "India" }],
  pa: [{ code: "IN", name: "India (Gurmukhi)" }, { code: "PK", name: "Pakistan (Shahmukhi)" }],
  ta: [{ code: "IN", name: "India" }, { code: "LK", name: "Sri Lanka" }],
  fa: [{ code: "IR", name: "Iran" }, { code: "AF", name: "Afghanistan", dialect: "Dari" }],
  ru: [{ code: "RU", name: "Russia" }],
  uk: [{ code: "UA", name: "Ukraine" }],
  ko: [{ code: "KR", name: "South Korea" }],
  ja: [{ code: "JP", name: "Japan" }],
  vi: [{ code: "VN", name: "Vietnam" }],
  fil: [{ code: "PH", name: "Philippines" }],
  tr: [{ code: "TR", name: "Turkey" }],
  he: [{ code: "IL", name: "Israel" }],
  ht: [{ code: "HT", name: "Haiti" }],
};

export const LANGUAGES: Language[] = ROWS.map(([code, name, nativeName, rtl]): Language => ({
  code,
  name,
  nativeName,
  dir: rtl ? "rtl" : "ltr",
  textQuality: STRONG.has(code) ? "strong" : LIMITED.has(code) ? "limited" : "fair",
  regions: REGIONS[code] ?? [],
})).sort((a, b) => a.name.localeCompare(b.name));

export const getLanguage = (code: string) => LANGUAGES.find((l) => l.code === code);

export const TEXT_QUALITY_LABEL: Record<TextQuality, string> = {
  strong: "Strong AI text (estimated)",
  fair: "Fair AI text (estimated)",
  limited: "Limited AI text (estimated)",
};

/** BCP-47 tag for speech, e.g. "es-MX". */
export const languageTag = (code: string, region: string | null) => (region ? `${code}-${region}` : code);

/** How the model should be told which language and dialect to use. */
export function languageInstruction(code: string, region: string | null) {
  const lang = getLanguage(code);
  if (!lang) return "English";
  const r = lang.regions.find((x) => x.code === region);
  return r?.dialect ?? (r ? `${lang.name} as spoken in ${r.name}` : lang.name);
}

/** How Nouri introduces itself when a conversation starts (device wake-up, web companion, ASI:One). */
export const NOURI_INTRO = "Hi, this is Nouri, your personal health companion.";

/** Preview greetings (not native-speaker reviewed except English). Others fall back to English. */
export const SAMPLE_GREETING: Record<string, string> = {
  en: `${NOURI_INTRO} How are you feeling today?`,
  es: "¡Hola! Soy Nouri. ¿Cómo se siente hoy?",
  ar: "مرحبًا! أنا نوري. كيف تشعر اليوم؟",
  am: "ሰላም! እኔ ኑሪ ነኝ። ዛሬ እንዴት ነዎት?",
  ti: "ሰላም! ኣነ ኑሪ እየ። ሎሚ ከመይ ኣለኹም?",
  fr: "Bonjour ! Je suis Nouri. Comment vous sentez-vous aujourd'hui ?",
  de: "Hallo! Ich bin Nouri. Wie geht es Ihnen heute?",
  it: "Ciao! Sono Nouri. Come si sente oggi?",
  pt: "Olá! Eu sou a Nouri. Como você está se sentindo hoje?",
  zh: "你好！我是Nouri。你今天感觉怎么样？",
  ja: "こんにちは！ヌーリです。今日のご気分はいかがですか？",
  ko: "안녕하세요! 저는 누리예요. 오늘 기분은 어떠세요?",
  hi: "नमस्ते! मैं नूरी हूँ। आज आप कैसा महसूस कर रहे हैं?",
  ru: "Здравствуйте! Я Нури. Как вы себя чувствуете сегодня?",
  sw: "Habari! Mimi ni Nouri. Unajisikiaje leo?",
  so: "Salaan! Waxaan ahay Nouri. Sidee tahay maanta?",
  tr: "Merhaba! Ben Nouri. Bugün nasıl hissediyorsunuz?",
  vi: "Xin chào! Tôi là Nouri. Hôm nay bạn cảm thấy thế nào?",
  fil: "Kumusta! Ako si Nouri. Ano ang pakiramdam mo ngayon?",
  fa: "سلام! من نوری هستم. امروز حالتان چطور است؟",
  ur: "السلام علیکم! میں نوری ہوں۔ آج آپ کیسا محسوس کر رہے ہیں؟",
  he: "שלום! אני נורי. איך אתם מרגישים היום?",
  uk: "Вітаю! Я Нурі. Як ви сьогодні почуваєтеся?",
  pl: "Dzień dobry! Jestem Nouri. Jak się Pan/Pani dziś czuje?",
};

/**
 * Fixed safety replies, used instead of any model output for emergencies and
 * dosing questions. English is the reviewed reference. The other translations
 * are drafts pending native-speaker review, so the English text is always shown
 * alongside them.
 */
export const SAFE_REPLY: Record<"emergency" | "dosing", Record<string, string>> = {
  emergency: {
    en: "That sounds serious. Please call 911 right now, or press your emergency button. This is a demo, so I can't place the call myself.",
    es: "Eso suena grave. Por favor, llame al 911 ahora mismo o presione su botón de emergencia. Esto es una demostración y no puedo hacer la llamada.",
    ar: "يبدو هذا خطيرًا. من فضلك اتصل بالرقم 911 الآن أو اضغط زر الطوارئ. هذا عرض تجريبي ولا أستطيع إجراء المكالمة بنفسي.",
    am: "ይህ አሳሳቢ ይመስላል። እባክዎ አሁኑኑ ወደ 911 ይደውሉ ወይም የአደጋ ጊዜ ቁልፍዎን ይጫኑ። ይህ ማሳያ ስለሆነ እኔ መደወል አልችልም።",
    ti: "እዚ ከቢድ ይመስል። በጃኹም ሕጂ ናብ 911 ደውሉ ወይ ናይ ህጹጽ ጊዜ መጠወቒኹም ጠውቑ። እዚ መርኣዪ ስለ ዝኾነ ባዕለይ ክድውል ኣይክእልን እየ።",
  },
  dosing: {
    en: "I can't help decide medication or insulin doses. Please follow your care plan and check with your doctor or care team.",
    es: "No puedo ayudar a decidir dosis de medicamentos o de insulina. Por favor, siga su plan de cuidado y consulte a su médico o equipo de atención.",
    ar: "لا أستطيع المساعدة في تحديد جرعات الدواء أو الإنسولين. من فضلك اتبع خطة رعايتك واستشر طبيبك أو فريق الرعاية.",
    am: "የመድሃኒት ወይም የኢንሱሊን መጠን ለመወሰን መርዳት አልችልም። እባክዎ የእንክብካቤ እቅድዎን ይከተሉ እና ሐኪምዎን ወይም የእንክብካቤ ቡድንዎን ያማክሩ።",
    ti: "ብዛሕ መድሃኒት ወይ ኢንሱሊን ክውስን ክሕግዝ ኣይክእልን እየ። በጃኹም ናይ ክንክን መደብኩም ተኸተሉ፣ ንሓኪምኩም ወይ ጉጅለ ክንክንኩም ኣማኽሩ።",
  },
};
