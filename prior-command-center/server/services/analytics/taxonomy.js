function includesAny(value, needles) {
  const normalized = (value || '').toLowerCase();
  return needles.some((needle) => normalized.includes(needle));
}

export function classifyPage(pathValue = '') {
  const path = pathValue.toLowerCase();

  let contentType = 'other';
  if (path === '/') contentType = 'homepage';
  else if (path.startsWith('/editorial/')) contentType = 'editorial';
  else if (path.startsWith('/capital-one/')) contentType = 'branded';
  else if (path.startsWith('/travel-design')) contentType = 'hub';
  else if (path.startsWith('/city-guides')) contentType = 'guide hub';
  else if (path.startsWith('/shopping-guides')) contentType = 'shopping guide';

  let contentTheme = 'general';
  if (path.startsWith('/capital-one/')) contentTheme = 'travel finance';
  else if (includesAny(path, ['/hotel-openings', '/hotel-opening'])) contentTheme = 'hotel openings';
  else if (includesAny(path, ['/travel-design'])) contentTheme = 'travel design';
  else if (includesAny(path, ['/shopping', '/shopping-guides'])) contentTheme = 'shopping';
  else if (includesAny(path, ['/city-guide', '/city-guides', '/travel-guide'])) contentTheme = 'destination guide';
  else if (includesAny(path, ['/editorial/'])) contentTheme = 'editorial';

  let funnelStage = 'mid';
  if (path === '/') funnelStage = 'top';
  else if (contentType === 'hub' || contentType === 'guide hub') funnelStage = 'top';
  else if (contentType === 'editorial' || contentTheme === 'destination guide') funnelStage = 'mid';
  else if (contentTheme === 'travel finance') funnelStage = 'bottom';

  return {
    content_type: contentType,
    content_theme: contentTheme,
    funnel_stage: funnelStage,
  };
}

export function classifyCampaign(name = '', subject = '') {
  const haystack = `${name} ${subject}`.toLowerCase();

  let campaignType = 'editorial';
  if (includesAny(haystack, ['webinar', 'recap', 'event'])) campaignType = 'event-led';
  else if (includesAny(haystack, ['guide', 'travel guide', 'city guide'])) campaignType = 'destination-led';
  else if (includesAny(haystack, ['hotel openings', 'openings'])) campaignType = 'news-led';
  else if (includesAny(haystack, ['roundup', 'weekly'])) campaignType = 'roundup';

  let contentTheme = 'general';
  if (includesAny(haystack, ['japan', 'morocco', 'fez', 'paris', 'milan', 'london'])) contentTheme = 'destination guide';
  else if (includesAny(haystack, ['hotel openings', 'hotel opening'])) contentTheme = 'hotel openings';
  else if (includesAny(haystack, ['capital one', 'finance', 'venture x'])) contentTheme = 'travel finance';
  else if (includesAny(haystack, ['webinar', 'event', 'recap'])) contentTheme = 'event follow-up';

  let funnelStage = 'mid';
  if (campaignType === 'roundup') funnelStage = 'top';
  if (campaignType === 'event-led') funnelStage = 'bottom';

  return {
    campaign_type: campaignType,
    content_theme: contentTheme,
    funnel_stage: funnelStage,
  };
}

export function normalizeSource(source = '', medium = '') {
  const rawSource = (source || '').trim().toLowerCase();
  const rawMedium = (medium || '').trim().toLowerCase();

  const normalizedSource = rawSource === '(direct)' ? 'direct' : (rawSource || 'direct');
  const normalizedMedium = rawMedium === '(none)' ? 'direct' : (rawMedium || 'direct');

  let channelGroup = 'referral/direct';
  if (normalizedSource.includes('klaviyo') || normalizedMedium.includes('email')) {
    channelGroup = 'email';
  } else if (normalizedMedium === 'organic' || normalizedSource.includes('google')) {
    channelGroup = 'organic search';
  } else if (['social', 'social-network', 'social media', 'paid social'].includes(normalizedMedium) ||
    ['instagram', 'facebook', 'linkedin', 'x', 'twitter', 'pinterest'].some((token) => normalizedSource.includes(token))) {
    channelGroup = 'social';
  } else if (normalizedSource === 'direct' || normalizedMedium === 'direct' || normalizedMedium === 'referral' || normalizedMedium === '(none)') {
    channelGroup = 'referral/direct';
  } else {
    channelGroup = 'web';
  }

  return {
    source: normalizedSource,
    medium: normalizedMedium,
    channel_group: channelGroup,
  };
}
