export interface ScriptTemplate {
  id: string;
  name: string;
  step: string;
  language: 'en' | 'bn';
  purpose: string;
  template: (params: {
    studentName: string;
    counsellorName: string;
    intake?: string;
    subject?: string;
    visitDate?: string;
    visitTime?: string;
  }) => string;
}

export const SICA_OFFICE_ADDRESS = 'Level 4, Navana Tower, Gulshan-1, Dhaka-1212, Bangladesh';
export const SICA_GOOGLE_MAPS_LINK = 'https://maps.google.com/?q=SICA+Dhaka+Office';
export const SICA_WEBINAR_LINK = 'https://studyinchina.academy/webinar-bd';
export const SICA_SCHOLARSHIP_GUIDE = 'https://studyinchina.academy/bd-scholarship-guide';

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'first_contact_en',
    name: 'First Contact (Day 0) - Missed Call Follow-up',
    step: 'Day 0',
    language: 'en',
    purpose: 'Send immediately after initial call attempt if unanswered',
    template: ({ studentName, counsellorName, intake = 'next intake' }) =>
      `Assalamu alaikum ${studentName}, this is ${counsellorName} from Study In China Academy (SICA). Thank you for your interest in studying in China! I just tried to call you. When is a good time for a quick 5-minute call? Meanwhile, could you share your last degree and result, the subject you want, and your target intake (${intake})?`,
  },
  {
    id: 'first_contact_bn',
    name: 'First Contact (বাংলা) - কল করার পর মেসেজ',
    step: 'Day 0',
    language: 'bn',
    purpose: 'বাংলায় বন্ধুত্বপূর্ণ প্রথম মেসেজ',
    template: ({ studentName, counsellorName }) =>
      `আসসালামু আলাইকুম ${studentName}, আমি Study In China Academy (SICA) থেকে ${counsellorName} বলছি। চায়নায় উচ্চশিক্ষায় আপনার আগ্রহের জন্য ধন্যবাদ! একটু আগে আমি আপনাকে কল করেছিলাম। সংক্ষেপে ৫ মিনিট কথা বলার জন্য কখন উপযুক্ত সময় হবে? এর মধ্যে আপনার বিগত পরীক্ষার রেজাল্ট, কাঙ্ক্ষিত বিষয় এবং টার্গেট সেশনটি জানালে উপযুক্ত স্কলারশিপ দেখতে সুবিধা হতো।`,
  },
  {
    id: 'day_1_consultation',
    name: 'Day 1 - Free Consultation & Webinar Invite',
    step: 'Day 1',
    language: 'en',
    purpose: 'Offer free 10-minute 1-on-1 profile evaluation & weekly webinar',
    template: ({ studentName, counsellorName }) =>
      `Hi ${studentName}, ${counsellorName} from SICA again. We offer a free 10-minute 1-on-1 consultation to check your profile and scholarship chances at Chinese universities. Would today or tomorrow suit you? You can also join our free webinar this Friday at 8:00 PM: ${SICA_WEBINAR_LINK}`,
  },
  {
    id: 'day_3_intake_fit',
    name: 'Day 3 - University & Scholarship Fit Check',
    step: 'Day 3',
    language: 'en',
    purpose: 'Focus on deadline urgency and personalized university matching',
    template: ({ studentName, intake = 'upcoming' }) =>
      `Hi ${studentName}, many Bangladeshi students are preparing for the ${intake} intake now, and some government & university scholarship deadlines close early. Send me your result and preferred subject, and I will tell you which universities fit your budget and profile. Shall I call you this evening?`,
  },
  {
    id: 'day_7_guide',
    name: 'Day 7 - Scholarship Guide & Re-engagement',
    step: 'Day 7',
    language: 'en',
    purpose: 'Value-first check-in with guide link',
    template: ({ studentName }) =>
      `Hi ${studentName}, just checking in! Here is our short guide on Chinese university scholarships & the application timeline: ${SICA_SCHOLARSHIP_GUIDE}. If China is still in your plans, reply YES and I will book your free consultation. If now is not the right time, tell me and I will check back later.`,
  },
  {
    id: 'office_visit_invite',
    name: 'Office Visit Invite (Primary Conversion Goal)',
    step: 'Conversion',
    language: 'en',
    purpose: 'Main goal: face-to-face document assessment with parents',
    template: ({ studentName, counsellorName }) =>
      `Great talking to you, ${studentName}! The best next step is a short meeting at our SICA Dhaka office to review your academic certificates and build your personalized university and scholarship plan together. Parents/guardians are warmly welcome. Does Wednesday or Thursday 3:00 PM work for you? Address: ${SICA_OFFICE_ADDRESS}. Map pin: ${SICA_GOOGLE_MAPS_LINK}`,
  },
  {
    id: 'visit_reminder',
    name: 'Office Visit Reminder (Day Before)',
    step: 'Visit',
    language: 'en',
    purpose: 'Sent by 18:00 the day before meeting to ensure high show-up',
    template: ({ studentName, visitDate = 'tomorrow', visitTime = '3:00 PM' }) =>
      `Hi ${studentName}, this is a reminder of your SICA office meeting on ${visitDate} at ${visitTime}, at ${SICA_OFFICE_ADDRESS} (${SICA_GOOGLE_MAPS_LINK}). Please bring your certificates, transcripts, and passport if you have one. Reply OK to confirm, or let me know if you need to reschedule!`,
  },
  {
    id: 'visit_noshow_recovery',
    name: 'No-Show Recovery (Within 30 Mins)',
    step: 'Recovery',
    language: 'en',
    purpose: 'Sent immediately after missed appointment to salvage lead',
    template: ({ studentName, counsellorName }) =>
      `Hi ${studentName}, we missed you at the SICA office today! I hope everything is fine. Shall we pick a fresh time? I can do tomorrow at 3:00 PM or Thursday at 4:30 PM, or a quick video call if that is easier for you and your parents.`,
  },
  {
    id: 'day_14_pause',
    name: 'Day 14 - Respectful Pause / Close Loop',
    step: 'Day 14',
    language: 'en',
    purpose: 'Polite pause before moving to nurture or closing',
    template: ({ studentName }) =>
      `Hi ${studentName}, I have not been able to reach you, so I will pause my messages for now. Whenever you are ready to plan your bachelor/masters studies in China, just reply here and I will be glad to assist you. Best of luck with your studies!`,
  },
];

/**
 * Builds a WhatsApp click-to-chat URL: wa.me/8801XXXXXXXXX?text=...
 */
export function getWhatsAppClickUrl(phoneE164: string, messageText: string): string {
  // Strip leading '+'
  const cleanPhone = phoneE164.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(messageText);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
