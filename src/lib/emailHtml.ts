import type { CampaignRecord, Department, DepartmentKey, HotelAccount } from '../types/domain'

/**
 * Email template families. Each business area keeps its own look (a bar email shouldn't look
 * like a hotel newsletter), but every family follows the same email-safe rules:
 * table layout, images with set sizes, no object-fit or background images (Outlook 2013),
 * one column and full-width buttons on mobile, tracked absolute links, unsubscribe footer.
 */
export type EmailFamily = 'Hotel' | 'Minimal' | 'Editorial' | 'Letter'
export type EmailStyle = {
  family: EmailFamily
  why: string
  width: number
  page: string
  panel: string
  text: string
  muted: string
  heading: string
  accent: string
  button: string
  buttonText: string
  footer: string
  footerText: string
  hero: boolean
}

const hotel: EmailStyle = {
  family: 'Hotel',
  why: 'cream, muted gold and navy with plenty of white space',
  width: 640,
  page: '#F4EFE6',
  panel: '#FFFFFF',
  text: '#33312C',
  muted: '#7A776E',
  heading: '#1F2B3A',
  accent: '#B08D57',
  button: '#1F2B3A',
  buttonText: '#FFFFFF',
  footer: '#EDE6DA',
  footerText: '#5F5B52',
  hero: true,
}

export const emailStyles: Record<DepartmentKey, EmailStyle> = {
  rooms: hotel,
  golf: hotel,
  beach_club: { ...hotel, heading: '#1F4E5F', button: '#1F4E5F' },
  spa: { ...hotel, family: 'Editorial', why: 'calm teal and ivory with soft gold accents — refined, not long', width: 600, page: '#EEF3F2', heading: '#2F5D62', button: '#2F5D62', footer: '#E6EEEC' },
  events: { ...hotel, family: 'Editorial', why: 'ivory, navy and muted gold like the wedding brochure — no green', width: 600, page: '#FAF6F0', heading: '#1E2A44', button: '#1E2A44', accent: '#B8975A', footer: '#F1EADF' },
  restaurant: { ...hotel, family: 'Minimal', why: 'narrow, black, ivory and gold — one strong image, no card grids', width: 560, page: '#F6F1E7', text: '#2A2A2A', heading: '#111111', button: '#111111', accent: '#A88B5C', footer: '#111111', footerText: '#CFC8BA' },
  hair_beauty: { ...hotel, family: 'Minimal', why: 'narrow and minimal, typography-led', width: 560, page: '#F7F1EE', heading: '#2B2B2B', button: '#2B2B2B', footer: '#EFE6E1' },
  meetings: { ...hotel, family: 'Letter', why: 'a personal note from the sender — relationship-led, not a glossy newsletter', width: 600, page: '#F4F4F2', footer: '#F4F4F2', hero: false },
}

/** Phrases that make hospitality copy read as generic or AI-written. */
export const genericPhrases = [
  'whether it’s',
  "whether it's",
  'sorted',
  'self-care',
  'escape the everyday',
  'ultimate indulgence',
  'treat yourself',
  'indulge',
  'unforgettable',
  'good food, good times',
  'look no further',
  'something for everyone',
]

const UNSUBSCRIBE = '{{ unsubscribe }}'

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function absoluteUrl(link: string, hotelAccount: Pick<HotelAccount, 'website'>): string {
  const value = link.trim()
  const base = (hotelAccount.website ?? '').replace(/\/$/, '')
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/')) return `${base}${value}`
  if (/^[\w-]+(\.[\w-]+)+/.test(value)) return `https://${value}`
  return `${base}/${value}`
}

/** Adds UTM tags for attribution, but keeps any tracking a link already carries. */
export function withTracking(url: string, campaign: Pick<CampaignRecord, 'name'>): string {
  try {
    const parsed = new URL(url)
    if ([...parsed.searchParams.keys()].some((key) => key.startsWith('utm_'))) return url
    parsed.searchParams.set('utm_source', 'email')
    parsed.searchParams.set('utm_medium', 'email')
    parsed.searchParams.set('utm_campaign', slug(campaign.name))
    return parsed.toString()
  } catch {
    return url
  }
}

/** Pre-cropped hero at a fixed ratio, as JPEG — the safest way to get exact dimensions in Outlook. */
export function heroImage(url: string, width: number): { src: string; width: number; height?: number } {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('images.unsplash.com')) {
      const height = Math.round((width * 9) / 16)
      parsed.searchParams.delete('auto')
      parsed.searchParams.set('fit', 'crop')
      parsed.searchParams.set('fm', 'jpg')
      parsed.searchParams.set('q', '72')
      parsed.searchParams.set('w', String(width * 2))
      parsed.searchParams.set('h', String(height * 2))
      return { src: parsed.toString(), width, height }
    }
  } catch {
    // fall through
  }
  return { src: url, width }
}

const sans = "Helvetica, Arial, sans-serif"
const serif = "Georgia, 'Times New Roman', serif"

export function buildEmailHtml(campaign: CampaignRecord, department: Department, hotelAccount: HotelAccount): string {
  const style = emailStyles[department.key]
  const email = campaign.email
  const W = style.width
  const href = escapeHtml(withTracking(absoluteUrl(campaign.website.link, hotelAccount), campaign))
  const hero = style.hero ? heroImage(department.image, W) : null
  const smallPrint = [campaign.offerTerms?.trim(), 'Subject to availability.'].filter(Boolean).join(' ')
  const paragraphs = email.body
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p style="margin:0 0 16px;font-family:${sans};font-size:16px;line-height:26px;color:${style.text};">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  const letter = style.family === 'Letter'

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(email.subject)}</title>
<style>
  body { margin:0; padding:0; background:${style.page}; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  @media only screen and (max-width:${W + 20}px) {
    .container { width:100% !important; }
    .px { padding-left:22px !important; padding-right:22px !important; }
    .fluid { width:100% !important; height:auto !important; }
    .h1 { font-size:24px !important; line-height:30px !important; }
    .btn, .btn td, .btn a { display:block !important; width:100% !important; box-sizing:border-box; text-align:center !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${style.page};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${style.page};opacity:0;">${escapeHtml(email.previewText)}${'&#847;&zwnj;&nbsp;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${style.page}" style="background:${style.page};">
<tr><td align="center" style="padding:24px 10px;">
<!--[if mso]><table role="presentation" width="${W}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="container" width="${W}" cellpadding="0" cellspacing="0" border="0" style="width:${W}px;max-width:${W}px;background:${style.panel};">
  <tr><td class="px" align="${letter ? 'left' : 'center'}" style="padding:24px 44px 20px;font-family:${serif};font-size:14px;letter-spacing:3px;text-transform:uppercase;color:${style.heading};">${escapeHtml(hotelAccount.name)}</td></tr>
${
  hero
    ? `  <tr><td><img class="fluid" src="${escapeHtml(hero.src)}" width="${hero.width}"${hero.height ? ` height="${hero.height}"` : ''} alt="${escapeHtml(email.headline)}" style="display:block;width:100%;max-width:${hero.width}px;height:auto;"></td></tr>\n`
    : ''
}  <tr><td class="px" style="padding:${hero ? 34 : 12}px 44px 4px;">
    ${letter ? `<p style="margin:0 0 18px;font-family:${sans};font-size:16px;line-height:26px;color:${style.text};">Hello,</p>` : ''}
    <h1 class="h1" style="margin:0 0 14px;font-family:${serif};font-weight:normal;font-size:28px;line-height:34px;color:${style.heading};">${escapeHtml(email.headline)}</h1>
    <table role="presentation" width="48" cellpadding="0" cellspacing="0" border="0"><tr><td height="2" bgcolor="${style.accent}" style="font-size:0;line-height:0;">&nbsp;</td></tr></table>
    <div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>
${paragraphs}
    ${email.offerDetails.trim() ? `<p style="margin:0;font-family:${sans};font-size:15px;line-height:24px;font-weight:bold;color:${style.heading};">${escapeHtml(email.offerDetails)}</p>` : ''}
  </td></tr>
  <tr><td class="px" style="padding:26px 44px 6px;">
    <table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${style.button}" style="background:${style.button};border-radius:2px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${sans};font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${style.buttonText};text-decoration:none;">${escapeHtml(email.ctaText)}</a>
    </td></tr></table>
  </td></tr>
${
  letter
    ? `  <tr><td class="px" style="padding:22px 44px 0;font-family:${sans};font-size:16px;line-height:26px;color:${style.text};">Best wishes,<br>${escapeHtml(email.senderName)}</td></tr>\n`
    : ''
}  <tr><td class="px" style="padding:22px 44px 30px;font-family:${sans};font-size:12px;line-height:18px;color:${style.muted};">${escapeHtml(smallPrint)}</td></tr>
  <tr><td class="px" align="center" bgcolor="${style.footer}" style="padding:22px 36px;background:${style.footer};font-family:${sans};font-size:12px;line-height:18px;color:${style.footerText};">
    ${escapeHtml(hotelAccount.name)} · ${escapeHtml(hotelAccount.location)}<br>
    You're receiving this because you opted in to hear from us. <a href="${UNSUBSCRIBE}" style="color:${style.footerText};text-decoration:underline;">Unsubscribe</a>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

export type EmailCheck = { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail?: string; verified?: boolean }

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)

/** Copy checks from the content, and template checks verified against the generated HTML itself. */
export function emailChecks(campaign: CampaignRecord, html: string): EmailCheck[] {
  const email = campaign.email
  const subject = email.subject.trim()
  const preview = email.previewText.trim()
  const copy = `${email.subject} ${email.previewText} ${email.headline} ${email.body} ${email.offerDetails} ${email.ctaText}`.toLowerCase()
  const found = genericPhrases.filter((phrase) => new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(copy))
  const subjectWords = new Set(words(subject.toLowerCase()).filter((word) => word.length > 3))
  const previewWords = words(preview.toLowerCase()).filter((word) => word.length > 3)
  const overlap = previewWords.length ? previewWords.filter((word) => subjectWords.has(word)).length / previewWords.length : 0
  const bodyWords = words(email.body).length
  const images = html.match(/<img\b[^>]*>/g) ?? []
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]).filter((value) => value !== UNSUBSCRIBE && !/^(mailto|tel):/.test(value))
  const bytes = new TextEncoder().encode(html).length

  return [
    {
      id: 'subject',
      label: 'Subject line under 60 characters',
      status: !subject || subject.length > 60 ? 'fail' : subject.length > 50 ? 'warn' : 'pass',
      detail: subject.length > 50 && subject.length <= 60 ? `${subject.length} characters — under 50 shows in full on most phones` : undefined,
    },
    {
      id: 'preview',
      label: 'Preview text adds something new',
      status: !preview || preview.length > 90 ? 'fail' : preview.toLowerCase().includes(subject.toLowerCase()) || overlap > 0.6 ? 'warn' : 'pass',
      detail: !preview ? 'Add a preview line' : preview.length > 90 ? `${preview.length}/90 characters` : overlap > 0.6 ? 'It repeats the subject — tease, don’t restate' : undefined,
    },
    { id: 'cta', label: 'Button text fits a mobile tap target', status: email.ctaText.trim() && email.ctaText.length <= 24 ? 'pass' : 'fail' },
    { id: 'link', label: 'Booking link set', status: campaign.website.link.trim() ? 'pass' : 'fail' },
    {
      id: 'generic',
      label: 'No generic marketing phrases',
      status: found.length ? 'fail' : 'pass',
      detail: found.length ? `Rewrite: “${found.join('”, “')}”` : undefined,
    },
    {
      id: 'concise',
      label: 'Main message is concise',
      status: bodyWords > 80 ? 'warn' : 'pass',
      detail: bodyWords > 80 ? `${bodyWords} words — sell the idea and let the landing page carry the details` : undefined,
    },
    {
      id: 'terms',
      label: 'Terms stay in the small print',
      status: /\b(terms|exclud\w*|t&cs?|subject to)\b/i.test(`${email.subject} ${email.headline}`) ? 'warn' : 'pass',
      detail: /\b(terms|exclud\w*|t&cs?|subject to)\b/i.test(`${email.subject} ${email.headline}`) ? 'Move conditions out of the subject and headline' : undefined,
    },
    { id: 'unsubscribe', label: 'Unsubscribe link in the footer', status: html.includes(UNSUBSCRIBE) ? 'pass' : 'fail', verified: true },
    {
      id: 'images',
      label: 'Images have set sizes and alt text',
      status: images.every((tag) => /\swidth="\d+"/.test(tag) && /\salt="/.test(tag)) ? 'pass' : 'fail',
      verified: true,
    },
    { id: 'outlook', label: 'Outlook-safe: no object-fit or background images', status: /object-fit|background-image|url\(/i.test(html) ? 'fail' : 'pass', verified: true },
    { id: 'mobile', label: 'One column and full-width buttons on mobile', status: /@media[^{]*max-width/.test(html) && html.includes('.btn') ? 'pass' : 'fail', verified: true },
    {
      id: 'links',
      label: 'Links are absolute and tracked',
      status: hrefs.length > 0 && hrefs.every((value) => /^https?:\/\//.test(value) && /utm_/.test(value)) ? 'pass' : 'fail',
      detail: hrefs.find((value) => !/^https?:\/\//.test(value)) ? 'A link isn’t a full web address' : undefined,
      verified: true,
    },
    {
      id: 'weight',
      label: 'Small enough to avoid Gmail clipping',
      status: bytes < 102_000 ? 'pass' : 'fail',
      detail: `${Math.round(bytes / 1024)} KB of 102 KB`,
      verified: true,
    },
  ]
}
