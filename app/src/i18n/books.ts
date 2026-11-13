import type { UiLang } from '../state/settings';

// Names of the 66 books per UI language, in canon order. They only show when the version in use does not include the book.
const NAMES: Record<UiLang, string> = {
  en: 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation',
  ar: 'سفر التكوين|سفر الخروج|سفر اللاويين|سفر العدد|سفر التثنية|سفر يشوع|سفر القضاة|سفر راعوث|سفر صموئيل الأول|سفر صموئيل الثانى|سفر الملوك الأول|سفر الملوك الثانى|سفر أخبار الأيام الأول|سفر أخبار الأيام الثانى|سفر عزرا|سفر نحميا|سفر أستير|سفر أيوب|سفر المزامير|سفر أمثال سليمان|سفر الجامعة|سفر نشيد الأناشيد|سفر إشعياء|سفر إرميا|سفر مراثي إرميا|سفر حزقيال|سفر دانيال|سفر هوشع|سفر يوئيل|سفر عاموس|سفر عوبديا|سفر يونان|سفر ميخا|سفر ناحوم|سفر حبقوق|سفر صفنيا|سفر حجي|سفر زكريا|سفر ملاخي|إنجيل متى|إنجيل مرقس|إنجيل لوقا|إنجيل يوحنا|سفر أعمال الرسل|الرسالة إلى رومية|الرسالة الأولى إلى كورنثوس|الرسالة الثانية إلى كورنثوس|الرسالة إلى غلاطية|الرسالة إلى أفسس|الرسالة إلى فيلبى|الرسالة إلى كولوسى|الرسالة الأولى إلى تسالونيكى|الرسالة الثانية إلى تسالونيكى|الرسالة الأولى إلى تيموثاوس|الرسالة الثانية إلى تيموثاوس|الرسالة إلى تيطس|الرسالة إلى فليمون|الرسالة إلى العبرانيين|رسالة يعقوب|رسالة بطرس الأولى|رسالة بطرس الثانية|رسالة يوحنا الأولى|رسالة يوحنا الثانية|رسالة يوحنا الثالثة|رسالة يهوذا|رؤيا يوحنا اللاهوتى',
};

const SPLIT = Object.fromEntries(Object.entries(NAMES).map(([k, v]) => [k, v.split('|')])) as Record<string, string[]>;

/** Book name in the UI language. `index` is the position in the canon.  */
export const localBookName = (lang: UiLang, index: number): string | undefined => SPLIT[lang]?.[index];
