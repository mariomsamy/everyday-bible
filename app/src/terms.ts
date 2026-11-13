import type { UiLang } from './state/settings';

/** Version of the terms and policy the person accepts. When changing the text of either, update the date. */
export const TERMS_VERSION = '2026-11-13';

interface Doc {
  updated: string;
  sections: { h: string; p: string[] }[];
}

/** Terms of use by language (Arabic and English). When changing the text, update both and the date. */
export const TERMS: Record<UiLang, Doc> = {
  en: {
    updated: 'Last updated: November 12, 2026',
    sections: [
      { h: 'Acceptance', p: ['By using this app you agree to these terms and to the privacy policy. If you do not agree, please do not use the app.'] },
      { h: 'The app', p: ['This is a free Bible reader with reading plans and progress tracking. It needs no account. It is provided as is, without warranty, and may change or stop at any time.'] },
      { h: 'Bible texts', p: ['Bible texts belong to their translators and publishers and are offered here as published by their sources.'] },
      { h: 'Your content', p: ['Your notes, highlights, reading plan and progress are yours. They are stored on your device only, so you are responsible for keeping a backup (Settings, Export).'] },
      { h: 'Sharing', p: ['When you share a verse you decide where it goes. The shared text and link are public to whoever receives them.'] },
      { h: 'Acceptable use', p: ['Do not misuse the app, try to break it, or flood it with requests.'] },
      { h: 'Liability', p: ['To the extent allowed by law, we are not liable for losses arising from the use of the app, including lost notes or progress.'] },
      { h: 'Changes', p: ['These terms may change. When they do, the date above is updated and you may be asked to accept them again.'] },
    ],
  },
  ar: {
    updated: 'آخر تحديث: 12 نوفمبر 2026',
    sections: [
      { h: 'الموافقة', p: ['باستخدامك هذا التطبيق فإنك توافق على هذه الشروط وعلى سياسة الخصوصية. إذا لم توافق فنرجو عدم استخدام التطبيق.'] },
      { h: 'التطبيق', p: ['هذا التطبيق قارئ مجاني للكتاب المقدس مع خطط قراءة وتتبّع للتقدّم، ولا يحتاج إلى حساب. يُقدَّم كما هو دون أي ضمان، وقد يتغيّر أو يتوقف في أي وقت.'] },
      { h: 'نصوص الكتاب المقدس', p: ['حقوق نصوص الكتاب المقدس تعود إلى مترجميها وناشريها، وتُعرض هنا كما نشرتها مصادرها.'] },
      { h: 'محتواك', p: ['ملاحظاتك وتظليلاتك وخطة قراءتك وتقدّمك ملكٌ لك، وتُحفظ على جهازك فقط. لذلك أنت مسؤول عن الاحتفاظ بنسخة احتياطية (الإعدادات ثم تصدير).'] },
      { h: 'المشاركة', p: ['عندما تشارك آية فأنت من يقرر وجهتها. النص والرابط المشارَكان متاحان لكل من يستلمهما.'] },
      { h: 'الاستخدام المناسب', p: ['لا تسئ استخدام التطبيق ولا تحاول تعطيله أو إغراقه بالطلبات.'] },
      { h: 'المسؤولية', p: ['بالقدر الذي يسمح به القانون، لا نتحمل مسؤولية أي خسائر ناتجة عن استخدام التطبيق، بما فيها فقدان الملاحظات أو التقدّم.'] },
      { h: 'التغييرات', p: ['قد تتغير هذه الشروط. وعند حدوث ذلك يُحدَّث التاريخ أعلاه وقد يُطلب منك الموافقة مجدداً.'] },
    ],
  },
};
