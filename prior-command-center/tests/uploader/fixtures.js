const curatedFixtures = [
  {
    id: 'clean-basic',
    title: 'A Villa Week in Puglia',
    expected: {
      title: 'A Villa Week in Puglia',
      slug: '/puglia-villa-week',
      emailSl: 'A villa is the easiest way to make summer travel feel private and generous.',
      keywords: ['puglia villa', 'italy villa', 'group travel'],
      bodyStartsWith: 'A good villa changes the equation for group travel.',
      bodyMustNotInclude: ['Email intro text:', 'Social:', 'Keywords:', 'Keep reading:'],
    },
    lines: [
      { text: 'Hed: A Villa Week in Puglia', size: 13, bold: true },
      { text: 'Dek: A guide to homes that work for families, friends, and summer itineraries.', size: 12 },
      { text: 'Slug: /puglia-villa-week', size: 12 },
      { text: 'Keywords: puglia villa, italy villa, group travel', size: 12 },
      { text: 'Email SL: A villa is the easiest way to make summer travel feel private and generous.', size: 12 },
      { text: 'Keep reading:', size: 12, bold: true },
      { text: 'A good villa changes the equation for group travel. It gives everyone room to gather, drift off, and return when the day slows down.', size: 11 },
      { text: 'In Puglia, the best stays feel grounded in place rather than staged for tourism.', size: 11 },
    ],
  },
  {
    id: 'bold-keep-reading-with-marketing-copy',
    title: 'Where to Rent a Villa This Summer',
    expected: {
      title: 'Where to Rent a Villa This Summer',
      slug: '/europe-villa-summer-guide',
      emailSl: 'Summer is approaching quickly. Now is the moment to think about where and how you want to stay.',
      social: 'Summer is creeping up fast. Think about where and how you want to stay in Europe.',
      keywords: ['european summer travel', 'villa rentals europe', 'luxury villa europe'],
      bodyStartsWith: 'A good villa changes the equation for group travel.',
      bodyMustNotInclude: ['Summer is approaching quickly.', 'Social:', 'Keywords:', 'Hero caption:'],
    },
    lines: [
      { text: 'Hed: Where to Rent a Villa This Summer', size: 13, bold: true },
      { text: 'Email intro text: Summer is approaching quickly. Now is the moment to think about where and how you want to stay.', size: 12 },
      { text: 'Social: Summer is creeping up fast. Think about where and how you want to stay in Europe.', size: 12 },
      { text: 'Keywords: european summer travel, villa rentals europe, luxury villa europe Slug: /europe-villa-summer-guide', size: 12 },
      { text: 'Hero caption: <figure><img src="XXXX" alt=""/><figcaption></figcaption></figure>', size: 12 },
      { text: 'Keep reading', size: 12, bold: true },
      { text: 'A good villa changes the equation for group travel. For starters, there is space to spread out, gather, and disperse.', size: 11 },
      { text: 'The best homes turn a trip into a rhythm rather than a sequence of reservations.', size: 11 },
    ],
  },
  {
    id: 'same-line-social-keywords-slug',
    title: 'Three Coastal Houses for August',
    expected: {
      title: 'Three Coastal Houses for August',
      slug: '/coastal-houses-august',
      keywords: ['summer house', 'coastal europe', 'august travel'],
      bodyStartsWith: 'The right house makes a group trip feel less logistical and more instinctive.',
      bodyMustNotInclude: ['Social:', 'Slug:', 'Keywords:'],
    },
    lines: [
      { text: 'Hed: Three Coastal Houses for August', size: 13, bold: true },
      { text: 'Social: Save this for August travel. Keywords: summer house, coastal europe, august travel Slug: /coastal-houses-august', size: 12 },
      { text: 'Keep reading:', size: 12, bold: true },
      { text: 'The right house makes a group trip feel less logistical and more instinctive.', size: 11 },
      { text: 'These are places where breakfast can stretch, afternoons can split, and dinners can come back together.', size: 11 },
    ],
  },
  {
    id: 'keep-reading-inline-body',
    title: 'A Slow Week in Menorca',
    expected: {
      title: 'A Slow Week in Menorca',
      bodyStartsWith: 'A good house is often the difference between a trip that feels busy and one that feels settled.',
      bodyMustNotInclude: ['Keep reading'],
    },
    lines: [
      { text: 'Hed: A Slow Week in Menorca', size: 13, bold: true },
      { text: 'Email preview text: A short list of homes that reward staying in.', size: 12 },
      { text: 'Keep reading: A good house is often the difference between a trip that feels busy and one that feels settled.', size: 12, bold: true },
      { text: 'Menorca works best when the schedule stays loose and the return home at dusk feels easy.', size: 11 },
    ],
  },
  {
    id: 'multi-line-keywords-before-body',
    title: 'A Guide to Houses for Groups',
    expected: {
      title: 'A Guide to Houses for Groups',
      keywords: ['group stay', 'villa guide', 'family travel'],
      bodyStartsWith: 'Travel changes when everyone can move at a different pace without losing the shape of the day.',
      bodyMustNotInclude: ['group stay', 'Keywords:', 'Email preheader text:'],
    },
    lines: [
      { text: 'Hed: A Guide to Houses for Groups', size: 13, bold: true },
      { text: 'Email preheader text: Homes that make multi-generational travel easier.', size: 12 },
      { text: 'Keywords:', size: 12, bold: true },
      { text: 'group stay, villa guide, family travel', size: 12 },
      { text: 'Keep reading', size: 12, bold: true },
      { text: 'Travel changes when everyone can move at a different pace without losing the shape of the day.', size: 11 },
      { text: 'The strongest homes hold both privacy and collective time without making either feel scheduled.', size: 11 },
    ],
  },
  {
    id: 'social-caption-alias',
    title: 'Design-Led Villas in Greece',
    expected: {
      title: 'Design-Led Villas in Greece',
      social: 'A shortlist of homes that feel calm, tactile, and deeply private.',
      bodyStartsWith: 'Some villas are beautiful in photographs and thin in person.',
      bodyMustNotInclude: ['Social caption:', 'A shortlist of homes that feel calm'],
    },
    lines: [
      { text: 'Hed: Design-Led Villas in Greece', size: 13, bold: true },
      { text: 'Social caption: A shortlist of homes that feel calm, tactile, and deeply private.', size: 12 },
      { text: 'Keep reading', size: 12, bold: true },
      { text: 'Some villas are beautiful in photographs and thin in person. The best ones change how a day feels once you arrive.', size: 11 },
      { text: 'They make the simplest parts of the trip feel unusually easy.', size: 11 },
    ],
  },
  {
    id: 'hero-caption-and-keep-reading',
    title: 'The Case for Renting the Whole House',
    expected: {
      title: 'The Case for Renting the Whole House',
      heroCaption: '<figure><img src="XXXX" alt=""/><figcaption></figcaption></figure>',
      bodyStartsWith: 'Private homes work best when a trip calls for both togetherness and the freedom to disappear for an hour.',
      bodyMustNotInclude: ['Hero caption:', '<figure><img src="XXXX"', 'Keep reading'],
    },
    lines: [
      { text: 'Hed: The Case for Renting the Whole House', size: 13, bold: true },
      { text: 'Hero caption: <figure><img src="XXXX" alt=""/><figcaption></figcaption></figure>', size: 12 },
      { text: 'Keep reading:', size: 12, bold: true },
      { text: 'Private homes work best when a trip calls for both togetherness and the freedom to disappear for an hour.', size: 11 },
      { text: 'That flexibility is what turns a booking into a better week.', size: 11 },
    ],
  },
  {
    id: 'multiple-marketing-blocks',
    title: 'A Better Way to Book for Summer',
    expected: {
      title: 'A Better Way to Book for Summer',
      emailSl: 'The best summer homes disappear early.',
      emailPt: 'A concise guide to booking a villa before the season closes in.',
      social: 'A faster way to think about villas this season.',
      bodyStartsWith: 'The best homes are not just places to sleep. They determine the pace and texture of the trip itself.',
      bodyMustNotInclude: ['The best summer homes disappear early.', 'A faster way to think about villas this season.'],
    },
    lines: [
      { text: 'Hed: A Better Way to Book for Summer', size: 13, bold: true },
      { text: 'Email subject line: The best summer homes disappear early.', size: 12 },
      { text: 'Email preview text: A concise guide to booking a villa before the season closes in.', size: 12 },
      { text: 'Social post: A faster way to think about villas this season.', size: 12 },
      { text: 'Keep reading', size: 12, bold: true },
      { text: 'The best homes are not just places to sleep. They determine the pace and texture of the trip itself.', size: 11 },
      { text: 'That is especially true when several people are trying to want different things at once.', size: 11 },
    ],
  },
  {
    id: 'article-body-boundary',
    title: 'A House That Holds the Whole Trip',
    expected: {
      title: 'A House That Holds the Whole Trip',
      keepReading: 'See the short list below.',
      bodyStartsWith: 'A well-chosen house can set the tone for a trip before anyone has even unpacked.',
      bodyMustNotInclude: ['Keep reading', 'See the short list below.'],
    },
    lines: [
      { text: 'Hed: A House That Holds the Whole Trip', size: 13, bold: true },
      { text: 'Keep reading: See the short list below.', size: 12, bold: true },
      { text: 'Article body:', size: 12, bold: true },
      { text: 'A well-chosen house can set the tone for a trip before anyone has even unpacked.', size: 11 },
      { text: 'The best ones create room for privacy, chance, and long shared meals without forcing any of it.', size: 11 },
    ],
  },
  {
    id: 'bold-inline-labels-with-article-body',
    title: 'Summer Houses for Groups',
    expected: {
      title: 'Summer Houses for Groups',
      emailSl: 'A short list of homes for slower group travel.',
      social: 'A shorter way into the season’s best group stays.',
      keywords: ['summer houses', 'group villas', 'slow travel'],
      bodyStartsWith: 'A strong house does more than solve logistics. It changes the emotional rhythm of the week.',
      bodyMustNotInclude: ['A short list of homes for slower group travel.', 'A shorter way into the season’s best group stays.', 'Keywords:'],
    },
    lines: [
      { text: 'Hed: Summer Houses for Groups', size: 13, bold: true },
      {
        size: 12,
        segments: [
          { text: 'Email intro text:', bold: true },
          { text: ' A short list of homes for slower group travel.', bold: false },
        ],
      },
      {
        size: 12,
        segments: [
          { text: 'Social caption:', bold: true },
          { text: ' A shorter way into the season’s best group stays.', bold: false },
        ],
      },
      {
        size: 12,
        segments: [
          { text: 'Keywords:', bold: true },
          { text: ' summer houses, group villas, slow travel', bold: false },
        ],
      },
      { text: 'Keep reading: A compact guide to better booking.', size: 12, bold: true },
      { text: 'Article body', size: 12, bold: true },
      { text: 'A strong house does more than solve logistics. It changes the emotional rhythm of the week.', size: 11 },
      { text: 'Once everyone can gather and drift apart without friction, the trip feels more natural.', size: 11 },
    ],
  },
  {
    id: 'bold-inline-article-body-same-line-copy',
    title: 'Booking a Better Villa Week',
    expected: {
      title: 'Booking a Better Villa Week',
      bodyStartsWith: 'The best villa weeks are shaped by flexibility rather than by a tightly managed schedule.',
      bodyMustNotInclude: ['Article body', 'Keep reading'],
    },
    lines: [
      { text: 'Hed: Booking a Better Villa Week', size: 13, bold: true },
      { text: 'Keep reading: A note for the newsletter module.', size: 12, bold: true },
      {
        size: 12,
        segments: [
          { text: 'Article body:', bold: true },
          { text: ' The best villa weeks are shaped by flexibility rather than by a tightly managed schedule.', bold: false },
        ],
      },
      { text: 'That flexibility comes from the house itself as much as the destination around it.', size: 11 },
    ],
  },
];

const emailLabels = [
  { label: 'Email intro text', field: 'emailSl' },
  { label: 'Email subject line', field: 'emailSl' },
  { label: 'Email SL', field: 'emailSl' },
  { label: 'Email preview text', field: 'emailPt' },
  { label: 'Email preheader text', field: 'emailPt' },
];

const socialLabels = [
  'Social',
  'Social copy',
  'Social caption',
  'Social post',
];

const keepReadingVariants = [
  { text: 'Keep reading', inline: false },
  { text: 'Keep reading:', inline: false },
  { text: 'Keep reading: {{BODY}}', inline: true },
];

const articleBodyVariants = [
  { text: 'Article body', inline: false },
  { text: 'Article body:', inline: false },
  { text: 'Article body: {{BODY}}', inline: true },
];

const keywordVariants = [
  { mode: 'single-line', build: (keywords) => `Keywords: ${keywords.join(', ')}` },
  { mode: 'multi-line', build: (keywords) => ['Keywords:', keywords.join(', ')] },
  {
    mode: 'mixed-line',
    build: (keywords, slug) => `Keywords: ${keywords.join(', ')} Slug: ${slug}`,
  },
];

function buildStressFixture(index, options) {
  const title = `Stress Fixture ${index + 1}`;
  const slug = `/stress-fixture-${index + 1}`;
  const bodyIntro = `The article body for stress fixture ${index + 1} should begin only after the article body boundary.`;
  const bodySecond = `This follow-up paragraph for stress fixture ${index + 1} makes it easier to spot leakage from the metadata block.`;
  const emailCopy = `Email setup copy ${index + 1} should never appear inside the article body.`;
  const socialCopy = `Social teaser ${index + 1} should also stay outside the article body.`;
  const keywords = [
    `stress keyword ${index + 1}a`,
    `stress keyword ${index + 1}b`,
    `stress keyword ${index + 1}c`,
  ];

  const lines = [
    { text: `Hed: ${title}`, size: 13, bold: true },
    { text: `${options.email.label}: ${emailCopy}`, size: 12 },
    { text: `${options.social}: ${socialCopy}`, size: 12 },
  ];

  const keywordBlock = options.keyword.mode === 'mixed-line'
    ? options.keyword.build(keywords, slug)
    : options.keyword.build(keywords, slug);

  if (Array.isArray(keywordBlock)) {
    for (const line of keywordBlock) {
      lines.push({ text: line, size: 12, bold: /^Keywords:?$/i.test(line) });
    }
    lines.push({ text: `Slug: ${slug}`, size: 12 });
  } else {
    lines.push({ text: keywordBlock, size: 12 });
    if (options.keyword.mode !== 'mixed-line') {
      lines.push({ text: `Slug: ${slug}`, size: 12 });
    }
  }

  if (options.includeHeroCaption) {
    lines.push({ text: 'Hero caption: <figure><img src="XXXX" alt=""/><figcaption></figcaption></figure>', size: 12 });
  }

  lines.push({ text: `${options.keepReadingLabel}: ${options.keepReadingCopy}`, size: 12, bold: true });

  if (options.articleBody.inline) {
    lines.push({ text: options.articleBody.text.replace('{{BODY}}', bodyIntro), size: 12, bold: true });
  } else {
    lines.push({ text: options.articleBody.text, size: 12, bold: true });
    lines.push({ text: bodyIntro, size: 11 });
  }

  lines.push({ text: bodySecond, size: 11 });

  const bodyMustNotInclude = [
    emailCopy,
    socialCopy,
    'Keywords:',
    'Slug:',
    'Article body',
  ];

  if (options.includeHeroCaption) {
    bodyMustNotInclude.push('Hero caption:');
  }

  const expected = {
    title,
    slug,
    bodyStartsWith: bodyIntro,
    bodyMustNotInclude,
    keywords,
  };

  if (options.email.field === 'emailSl') {
    expected.emailSl = emailCopy;
  } else {
    expected.emailPt = emailCopy;
  }

  expected.social = socialCopy;

  if (options.includeHeroCaption) {
    expected.heroCaption = '<figure><img src="XXXX" alt=""/><figcaption></figcaption></figure>';
  }

  return {
    id: `stress-${String(index + 1).padStart(2, '0')}-${options.email.label.toLowerCase().replace(/\s+/g, '-')}-${options.social.toLowerCase().replace(/\s+/g, '-')}-${options.keyword.mode}-${options.articleBody.inline ? 'inline' : 'boundary'}${options.includeHeroCaption ? '-hero' : ''}`,
    title,
    expected,
    lines,
  };
}

function buildGeneratedStressFixtures() {
  const combos = [];
  let index = 0;

  for (const email of emailLabels) {
    for (const social of socialLabels) {
      for (const keyword of keywordVariants) {
        const keepReading = keepReadingVariants[index % keepReadingVariants.length];
        const articleBody = articleBodyVariants[index % articleBodyVariants.length];
        const includeHeroCaption = index % 2 === 0;
        combos.push(buildStressFixture(index, {
          email,
          social,
          keyword,
          keepReadingLabel: keepReading.text.replace(/:\s*\{\{BODY\}\}|:\s*$|\s*\{\{BODY\}\}$/g, ''),
          keepReadingCopy: `Keep reading helper copy ${index + 1} should stay in metadata.`,
          articleBody,
          includeHeroCaption,
        }));
        index++;
      }
    }
  }

  return combos;
}

export const uploaderFixtures = [
  ...curatedFixtures,
  ...buildGeneratedStressFixtures(),
];
