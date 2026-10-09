import { CompanyProfile } from '../types';
import { DEFAULT_COMPANY } from '../data/mockData';

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

export const DEFAULT_OFFICE_ADDRESS = 'Level 4, Navana Tower, Gulshan-1, Dhaka-1212, Bangladesh';
export const DEFAULT_GOOGLE_MAPS_LINK = 'https://maps.google.com/?q=Navana+Tower+Gulshan+Dhaka';
export const DEFAULT_WEBINAR_LINK = 'https://apexadmissions.com/live-webinar';
export const DEFAULT_SCHOLARSHIP_GUIDE = 'https://apexadmissions.com/scholarship-guide';

export function getScriptTemplates(company: CompanyProfile = DEFAULT_COMPANY): ScriptTemplate[] {
  const companyName = company.name || 'Our Admissions Team';
  const shortName = company.short_name || company.name || 'Admissions';
  const address = company.office_address || DEFAULT_OFFICE_ADDRESS;
  const mapsLink = company.google_maps_link || DEFAULT_GOOGLE_MAPS_LINK;
  const webinarLink = company.webinar_link || DEFAULT_WEBINAR_LINK;
  const guideLink = company.guide_link || DEFAULT_SCHOLARSHIP_GUIDE;

  return [
    {
      id: 'first_contact_en',
      name: 'First Contact (Day 0) - Missed Call Follow-up',
      step: 'Day 0',
      language: 'en',
      purpose: 'Send immediately after initial call attempt if unanswered',
      template: ({ studentName, counsellorName, intake = 'next intake' }) =>
        `Assalamu alaikum ${studentName}, this is ${counsellorName} from ${companyName}. Thank you for your inquiry! I just tried to call you. When is a good time for a quick 5-minute call? Meanwhile, could you share your academic background, the program you want, and your target intake (${intake})?`,
    },
    {
      id: 'first_contact_bn',
      name: 'First Contact (বাংলা) - কল করার পর মেসেজ',
      step: 'Day 0',
      language: 'bn',
      purpose: 'বাংলায় বন্ধুত্বপূর্ণ প্রথম মেসেজ',
      template: ({ studentName, counsellorName }) =>
        `আসসালামু আলাইকুম ${studentName}, আমি ${companyName} থেকে ${counsellorName} বলছি। আমাদের সেবায় আপনার আগ্রহের জন্য ধন্যবাদ! একটু আগে আমি আপনাকে কল করেছিলাম। সংক্ষেপে ৫ মিনিট কথা বলার জন্য কখন উপযুক্ত সময় হবে? এর মধ্যে আপনার বিগত পরীক্ষার রেজাল্ট, কাঙ্ক্ষিত বিষয় এবং টার্গেট সেশনটি জানালে উপযুক্ত স্কলারশিপ দেখতে সুবিধা হতো।`,
    },
    {
      id: 'day_1_consultation',
      name: 'Day 1 - Free Consultation & Webinar Invite',
      step: 'Day 1',
      language: 'en',
      purpose: 'Offer free 10-minute 1-on-1 profile evaluation & weekly webinar',
      template: ({ studentName, counsellorName }) =>
        `Hi ${studentName}, ${counsellorName} from ${shortName} again. We offer a free 10-minute 1-on-1 consultation to evaluate your profile and scholarship eligibility. Would today or tomorrow suit you? You can also join our live discovery webinar this Friday at 8:00 PM: ${webinarLink}`,
    },
    {
      id: 'day_3_intake_fit',
      name: 'Day 3 - University & Scholarship Fit Check',
      step: 'Day 3',
      language: 'en',
      purpose: 'Focus on deadline urgency and personalized university matching',
      template: ({ studentName, intake = 'upcoming' }) =>
        `Hi ${studentName}, many candidates are preparing for the ${intake} intake now, and key merit scholarships close early. Send me your result and preferred course, and I will check which universities fit your profile and budget. Shall I call you this evening?`,
    },
    {
      id: 'day_7_guide',
      name: 'Day 7 - Admission Guide & Re-engagement',
      step: 'Day 7',
      language: 'en',
      purpose: 'Value-first check-in with guide link',
      template: ({ studentName }) =>
        `Hi ${studentName}, just checking in! Here is our comprehensive admissions & scholarship timeline guide: ${guideLink}. If this is still in your plans, reply YES and I will book your free evaluation. If now is not the right time, let me know and I will check back later.`,
    },
    {
      id: 'office_visit_invite',
      name: 'Office Visit Invite (Primary Conversion Goal)',
      step: 'Conversion',
      language: 'en',
      purpose: 'Main goal: face-to-face document assessment with parents',
      template: ({ studentName, counsellorName }) =>
        `Great talking to you, ${studentName}! The best next step is a short meeting at our ${shortName} office to review your academic credentials and build your personalized roadmap together. Parents/guardians are warmly welcome. Does Wednesday or Thursday 3:00 PM work for you? Address: ${address}. Map pin: ${mapsLink}`,
    },
    {
      id: 'visit_reminder',
      name: 'Office Visit Reminder (Day Before)',
      step: 'Visit',
      language: 'en',
      purpose: 'Sent by 18:00 the day before meeting to ensure high show-up',
      template: ({ studentName, visitDate = 'tomorrow', visitTime = '3:00 PM' }) =>
        `Hi ${studentName}, this is a reminder of your appointment with ${shortName} on ${visitDate} at ${visitTime}, at ${address} (${mapsLink}). Please bring your certificates, transcripts, and passport if you have one. Reply OK to confirm, or let me know if you need to reschedule!`,
    },
    {
      id: 'visit_noshow_recovery',
      name: 'No-Show Recovery (Within 30 Mins)',
      step: 'Recovery',
      language: 'en',
      purpose: 'Sent immediately after missed appointment to salvage lead',
      template: ({ studentName, counsellorName }) =>
        `Hi ${studentName}, we missed you at the ${shortName} office today! I hope everything is fine. Shall we pick a fresh time? I can do tomorrow at 3:00 PM or Thursday at 4:30 PM, or a quick video call if that is easier for you and your parents.`,
    },
    {
      id: 'day_14_pause',
      name: 'Day 14 - Respectful Pause / Close Loop',
      step: 'Day 14',
      language: 'en',
      purpose: 'Polite pause before moving to nurture or closing',
      template: ({ studentName }) =>
        `Hi ${studentName}, I have not been able to reach you, so I will pause my messages for now. Whenever you are ready to explore your higher education options, just reply here and ${shortName} will be glad to assist you. Wishing you all the best!`,
    },
  ];
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = getScriptTemplates(DEFAULT_COMPANY);


/**
 * Builds a WhatsApp click-to-chat URL: wa.me/8801XXXXXXXXX?text=...
 */
export function getWhatsAppClickUrl(phoneE164: string, messageText: string): string {
  // Strip leading '+'
  const cleanPhone = phoneE164.replace(/[^0-9]/g, '');
  const encodedText = encodeURIComponent(messageText);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}
