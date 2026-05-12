export const SCHEMA_VERSION = '2.0';
export const APP_ID = 'bpwApp';
export const LOG_PREFIX = '[BPW]';

export const BRAND_TYPES = {
  commercial: { label: 'Commercial business', icon: 'building',  color: 'var(--bpw-primary)' },
  local:      { label: 'Local business',      icon: 'store',     color: 'var(--bpw-success)' },
  creator:    { label: 'Content creator',     icon: 'video',     color: 'var(--bpw-accent)' },
  nonprofit:  { label: 'Non-commercial',      icon: 'heart',     color: 'var(--bpw-warning)' }
};

export const BRAND_SUBTYPES = {
  commercial: [
    { id: 'saas', label: 'SaaS / Software' }, { id: 'ecommerce', label: 'E-commerce / Retail' },
    { id: 'agency', label: 'Agency / Consultancy' }, { id: 'services', label: 'Professional Services' },
    { id: 'marketplace', label: 'Marketplace' }, { id: 'other', label: 'Other' }
  ],
  local: [
    { id: 'restaurant', label: 'Restaurant / F&B' }, { id: 'health', label: 'Health & Wellness' },
    { id: 'retail', label: 'Retail Store' }, { id: 'professional', label: 'Professional Practice' },
    { id: 'home', label: 'Home Services' }, { id: 'other', label: 'Other' }
  ],
  creator: [
    { id: 'youtube', label: 'YouTube Channel' }, { id: 'blog', label: 'Blog / Newsletter' },
    { id: 'podcast', label: 'Podcast' }, { id: 'social', label: 'Social Media Brand' },
    { id: 'multi', label: 'Multi-platform' }, { id: 'other', label: 'Other' }
  ],
  nonprofit: [
    { id: 'ngo', label: 'NGO / Nonprofit' }, { id: 'community', label: 'Community / Association' },
    { id: 'education', label: 'Educational Institution' }, { id: 'government', label: 'Government / Public' },
    { id: 'other', label: 'Other' }
  ]
};

export const DETECTION_DOES = [
  { id: 'products', icon: 'box',       label: 'Sells products',             desc: 'Physical or digital products, e-commerce, retail' },
  { id: 'services', icon: 'handshake', label: 'Provides services',          desc: 'Consulting, agency, professional, health, legal' },
  { id: 'content',  icon: 'video',     label: 'Creates content',            desc: 'Videos, articles, podcasts, newsletters, social media' },
  { id: 'cause',    icon: 'heart',     label: 'Serves a cause / community', desc: 'Nonprofit, education, government, community org' }
];

export const DETECTION_WHERE = [
  { id: 'online',   icon: 'globe',            label: 'Online / digital only' },
  { id: 'physical', icon: 'location-dot',     label: 'Physical location(s)' },
  { id: 'both',     icon: 'arrows-left-right', label: 'Both online & physical' }
];

export const DETECTION_REVENUE = [
  { id: 'products',      icon: 'shopping-cart',      label: 'Product sales' },
  { id: 'services',      icon: 'briefcase',          label: 'Service fees' },
  { id: 'subscriptions', icon: 'rotate',             label: 'Subscriptions' },
  { id: 'ads',           icon: 'rectangle-ad',       label: 'Ads / sponsorships' },
  { id: 'courses',       icon: 'graduation-cap',     label: 'Courses / digital products' },
  { id: 'donations',     icon: 'hand-holding-heart', label: 'Donations / grants' },
  { id: 'none',          icon: 'ban',                label: 'Not monetized' }
];

export const LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' }, { code: 'ta', label: 'Tamil' },
  { code: 'mr', label: 'Marathi' }, { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' }, { code: 'ml', label: 'Malayalam' },
  { code: 'gu', label: 'Gujarati' }
];

export const LANG_NAMES = LANGUAGES.reduce(function(acc, l) {
  acc[l.code] = l.label;
  return acc;
}, {});

export const SOCIAL_PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',        icon: 'fa-brands fa-youtube' },
  { id: 'instagram', label: 'Instagram',      icon: 'fa-brands fa-instagram' },
  { id: 'linkedin',  label: 'LinkedIn',       icon: 'fa-brands fa-linkedin' },
  { id: 'twitter_x', label: 'Twitter / X',    icon: 'fa-brands fa-x-twitter' },
  { id: 'facebook',  label: 'Facebook',       icon: 'fa-brands fa-facebook' },
  { id: 'tiktok',    label: 'TikTok',         icon: 'fa-brands fa-tiktok' },
  { id: 'google_business', label: 'Google Business', icon: 'fa-brands fa-google' },
  { id: 'other',     label: 'Other',          icon: 'fa-solid fa-link' }
];

export const BRAND_ARCHETYPES = [
  'Creator', 'Sage', 'Hero', 'Explorer', 'Ruler', 'Caregiver',
  'Magician', 'Rebel', 'Lover', 'Jester', 'Everyperson', 'Innocent'
];

export const SECTION_STATES = {
  pending:   { label: 'Pending',    icon: 'circle',           color: 'var(--bpw-muted)' },
  loading:   { label: 'Generating', icon: 'spinner fa-spin',  color: 'var(--bpw-primary)' },
  generated: { label: 'Generated',  icon: 'sparkles',         color: 'var(--bpw-primary)' },
  editing:   { label: 'Editing',    icon: 'pen',              color: 'var(--bpw-warning)' },
  manual:    { label: 'Editing',    icon: 'pen-to-square',    color: 'var(--bpw-warning)' },
  accepted:  { label: 'Accepted',   icon: 'check-circle',     color: 'var(--bpw-success)' },
  rejected:  { label: 'Rejected',   icon: 'circle-xmark',     color: 'var(--bpw-error)' }
};

export const LEVEL_ORDER = { 'new': 0, 'growing': 1, 'deep': 2 };

export const AI_ENDPOINTS = {
  'gemini':      'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
  'claude':      'https://api.anthropic.com/v1/messages',
  'openai':      'https://api.openai.com/v1/chat/completions',
  'grok':        'https://api.x.ai/v1/chat/completions',
  'groq':        'https://api.groq.com/openai/v1/chat/completions',
  'nvidia':      'https://integrate.api.nvidia.com/v1/chat/completions',
  'huggingface': 'https://router.huggingface.co/v1/chat/completions',
  'openrouter':  'https://openrouter.ai/api/v1/chat/completions'
};

export const PROVIDER_ICONS = {
  gemini: 'sparkles', claude: 'bolt', openai: 'cube', grok: 'bolt',
  groq: 'bolt', nvidia: 'cube', huggingface: 'cube', openrouter: 'shuffle'
};
