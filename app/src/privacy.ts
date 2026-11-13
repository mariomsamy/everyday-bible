import type { UiLang } from './state/settings';

/** Contact for privacy requests. Set VITE_CONTACT_EMAIL when building; shown in the policy. */
export const PRIVACY_EMAIL: string = import.meta.env.VITE_CONTACT_EMAIL || 'privacy@example.com';

interface Policy {
  updated: string;
  sections: { h: string; p: string[] }[];
}

/** Privacy policy by language (Arabic and English). When changing the text, update both and the date (and TERMS_VERSION). */
export const PRIVACY: Record<UiLang, Policy> = {
  en: {
    updated: 'Last updated: November 13, 2026',
    sections: [
      { h: 'No account, no personal data', p: ['The app needs no registration. We never ask for your name, email, phone number or any identity document.'] },
      { h: 'What stays on your device', p: ['Your reading progress, reading plan, notes, highlights, bookmarks and settings are saved only on your device. Because reading habits can reveal religious belief, we treat them as sensitive and do not send the list of chapters you read to our server.'] },
      { h: 'Anonymous statistics (optional)', p: ['Only if you turn them on, the app sends anonymous events to our own server: screens opened, the Bible version, the number of chapters you finished, the book, and your plan length, the length of your streak, and which sharing option you used. Events carry a random identifier created on your device. It is not linked to your name, and we do not store your IP address.', 'We never send verse text, notes or the exact chapters you read. Statistics are kept for 13 months and then deleted. You can turn them off, or delete everything already sent, in Settings.'] },
      { h: 'Downloading Bible texts', p: ['When you download a Bible version, your browser fetches it once from this site\'s own server. Only if the site owner has enabled a fallback and our server does not have the file, it may be fetched from the public jsDelivr CDN or GitHub, which can then see your IP address and the file you requested, but nothing else from the app.'] },
      { h: 'AI assistant (optional)', p: ['If the site owner has turned on the AI assistant, when you ask it a question the app sends your question, the verse or passage on screen and your recent messages to the AI provider the owner chose, through our server, to produce an answer. We do not send your name, IP address or any device identifier to that provider, and we do not store your questions. The provider processes them under its own terms and may do so outside your country. Do not type personal or sensitive information into the assistant. Using it is entirely optional.'] },
      { h: 'Advertising pixels (optional)', p: ['Only if you turn this on separately, the app loads measurement pixels from third parties (such as Meta, TikTok, Snapchat or Google), if the site owner has configured them. These companies may receive technical data such as your IP address and device details and may process it outside your country. If you do not turn this on, none of them is loaded.'] },
      { h: 'Age', p: ['Optional statistics and pixels are only for people aged 18 or over, or with the permission of a parent or guardian. Reading the Bible works without them.'] },
      { h: 'Your rights', p: ['You may withdraw consent at any time in Settings, export your data, and delete the statistics already sent. For other requests write to ' + PRIVACY_EMAIL + '. If a data breach affects you we will notify the authorities and you within 72 hours as required by law.'] },
      { h: 'Changes', p: ['If this policy changes, the date above is updated and your consent is asked for again.'] },
    ],
  },
  ar: {
    updated: 'آخر تحديث: 13 نوفمبر 2026',
    sections: [
      { h: 'بلا حساب وبلا بيانات شخصية', p: ['لا يحتاج التطبيق إلى تسجيل. لا نطلب اسمك ولا بريدك الإلكتروني ولا رقم هاتفك ولا أي وثيقة هوية.'] },
      { h: 'ما يبقى على جهازك', p: ['تقدّمك في القراءة وخطة القراءة والملاحظات والتظليلات والإشارات والإعدادات تُحفظ على جهازك فقط. ولأن عادات القراءة قد تكشف المعتقد الديني فإننا نعدّها بيانات حساسة، ولا نرسل إلى خادمنا قائمة الأصحاحات التي قرأتها.'] },
      { h: 'إحصاءات مجهولة (اختيارية)', p: ['إذا فعّلتها فقط، يرسل التطبيق أحداثاً مجهولة إلى خادمنا نحن: الشاشات المفتوحة، ونسخة الكتاب المقدس، وعدد الأصحاحات التي أنهيتها ومدة خطتك، وعدد الأيام المتتالية، وخيار المشاركة الذي استخدمته. وترتبط الأحداث بمعرّف عشوائي أُنشئ على جهازك، ولا يرتبط باسمك، ولا نحفظ عنوان IP الخاص بك.', 'لا نرسل أبداً نص الآيات ولا ملاحظاتك ولا الأصحاحات التي قرأتها بالتحديد. تُحفظ الإحصاءات 13 شهراً ثم تُحذف. ويمكنك إيقافها أو حذف كل ما أُرسل سابقاً من الإعدادات.'] },
      { h: 'تنزيل نصوص الكتاب المقدس', p: ['عند تنزيل ترجمة، يجلبها متصفحك مرة واحدة من خادم هذا الموقع نفسه. وفقط إذا فعّل مالك الموقع خيارًا احتياطيًا ولم يكن الملف على خادمنا، قد يُجلب من شبكة jsDelivr العامة أو من GitHub، فيستطيعان رؤية عنوان IP واسم الملف المطلوب، ولا شيء آخر من التطبيق.'] },
      { h: 'المساعد الذكي (اختياري)', p: ['إذا فعّل مالك الموقع المساعد الذكي، فعند طرح سؤال يرسل التطبيق سؤالك والآية أو المقطع المعروض ورسائلك الأخيرة إلى مزوّد الذكاء الاصطناعي الذي اختاره المالك، عبر خادمنا، لإنتاج الإجابة. لا نرسل اسمك ولا عنوان IP ولا أي معرّف جهاز إلى ذلك المزوّد، ولا نخزّن أسئلتك. يعالجها المزوّد وفق شروطه وقد يكون ذلك خارج بلدك. لا تكتب بيانات شخصية أو حساسة في المساعد. استخدامه اختياري تمامًا.'] },
      { h: 'بيكسلات الإعلانات (اختيارية)', p: ['إذا فعّلت هذا الخيار بشكل منفصل فقط، يحمّل التطبيق بيكسلات قياس من أطراف ثالثة (مثل ميتا وتيك توك وسناب شات وجوجل) إن كان صاحب الموقع قد أعدّها. قد تتلقى هذه الشركات بيانات تقنية مثل عنوان IP وتفاصيل الجهاز وقد تعالجها خارج بلدك. وإن لم تفعّل هذا الخيار فلن يُحمَّل أي منها.'] },
      { h: 'السن', p: ['الإحصاءات والبيكسلات الاختيارية مخصّصة لمن بلغ 18 عاماً، أو بإذن ولي الأمر. ويعمل التطبيق للقراءة بدونها تماماً.'] },
      { h: 'حقوقك', p: ['يمكنك سحب موافقتك في أي وقت من الإعدادات، وتصدير بياناتك، وحذف الإحصاءات التي أُرسلت. ولأي طلب آخر راسلنا على ' + PRIVACY_EMAIL + '. وإذا تعرّضت بياناتك لاختراق فسنُخطر الجهات المختصة وإياك خلال 72 ساعة كما يقتضي القانون.'] },
      { h: 'التغييرات', p: ['إذا تغيّرت هذه السياسة يُحدَّث التاريخ أعلاه ونطلب موافقتك من جديد.'] },
    ],
  },
};
