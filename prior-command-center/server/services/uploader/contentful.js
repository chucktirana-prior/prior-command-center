import contentful from 'contentful-management';
import config, { getMissingContentfulConfig } from '../../config.js';

let clientInstance = null;

function ensureContentfulConfig() {
  const missing = getMissingContentfulConfig();
  if (missing.length > 0) {
    throw new Error(`Contentful is not configured. Missing: ${missing.join(', ')}`);
  }
}

function getClient() {
  ensureContentfulConfig();
  if (!clientInstance) {
    clientInstance = contentful.createClient({
      accessToken: config.contentful.cmaToken,
    });
  }
  return clientInstance;
}

async function getEnvironment() {
  const client = getClient();
  const space = await client.getSpace(config.contentful.spaceId);
  return space.getEnvironment(config.contentful.environment);
}

export async function searchAuthors(query) {
  const env = await getEnvironment();
  const entries = await env.getEntries({
    content_type: config.contentful.personTypeId,
    'fields.name[match]': query,
    limit: 10,
  });
  return entries.items.map((item) => ({
    id: item.sys.id,
    name: item.fields.name?.['en-US'] || item.fields.name || '',
  }));
}

export async function listCategories() {
  const env = await getEnvironment();
  const entries = await env.getEntries({
    content_type: config.contentful.categoryTypeId,
    limit: 100,
    order: 'fields.name',
  });
  return entries.items.map((item) => ({
    id: item.sys.id,
    name: item.fields.name?.['en-US'] || item.fields.name || '',
  }));
}

export async function createDraftArticle(fields) {
  const env = await getEnvironment();

  const cfFields = {
    title: { 'en-US': fields.title },
    subtitle: { 'en-US': fields.subtitle },
    slug: { 'en-US': fields.slug },
    homepageExcerpt: { 'en-US': fields.homepageExcerpt },
    metaTitle: { 'en-US': fields.metaTitle },
    metaDescription: { 'en-US': fields.metaDescription },
    keywords: { 'en-US': fields.keywords || [] },
    articleBody: { 'en-US': fields.articleBody },
    hideFromLatestArticles: { 'en-US': fields.hideFromLatestArticles || false },
    isFreeContent: { 'en-US': fields.isFreeContent || false },
  };

  if (fields.datePublished) {
    cfFields.datePublished = { 'en-US': fields.datePublished };
  }
  if (fields.updatedAt) {
    cfFields.updatedAt = { 'en-US': fields.updatedAt };
  }

  if (fields.authorId) {
    cfFields.author = {
      'en-US': {
        sys: { type: 'Link', linkType: 'Entry', id: fields.authorId },
      },
    };
  }

  if (fields.categoryIds?.length) {
    cfFields.categories = {
      'en-US': fields.categoryIds.map((id) => ({
        sys: { type: 'Link', linkType: 'Entry', id },
      })),
    };
  }

  if (fields.heroImageAssetId) {
    cfFields.heroImage = {
      'en-US': {
        sys: { type: 'Link', linkType: 'Asset', id: fields.heroImageAssetId },
      },
    };
  }

  if (fields.heroCaption) {
    cfFields.heroCaption = { 'en-US': fields.heroCaption };
  }

  if (fields.indexImageAssetId) {
    cfFields.indexImage = {
      'en-US': {
        sys: { type: 'Link', linkType: 'Asset', id: fields.indexImageAssetId },
      },
    };
  }

  const entry = await env.createEntry(config.contentful.articleTypeId, {
    fields: cfFields,
  });

  return {
    entryId: entry.sys.id,
    spaceId: config.contentful.spaceId,
    environment: config.contentful.environment,
  };
}

async function uploadSingleAsset(env, file, fileMeta, label) {
  const title = fileMeta.title || file.originalname;
  const figureIndex = fileMeta.figureIndex;

  const upload = await env.createUpload({ file: file.buffer });

  const asset = await env.createAsset({
    fields: {
      title: { 'en-US': title },
      file: {
        'en-US': {
          contentType: file.mimetype,
          fileName: file.originalname,
          uploadFrom: {
            sys: {
              type: 'Link',
              linkType: 'Upload',
              id: upload.sys.id,
            },
          },
        },
      },
    },
  });

  await asset.processForLocale('en-US');

  let readyAsset;
  for (let attempt = 0; attempt < 30; attempt++) {
    readyAsset = await env.getAsset(asset.sys.id);
    const fileInfo = readyAsset.fields.file?.['en-US'];
    if (fileInfo && fileInfo.url) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!readyAsset?.fields?.file?.['en-US']?.url) {
    throw new Error(`Asset processing timed out for ${file.originalname}`);
  }

  await readyAsset.publish();

  const url = 'https:' + readyAsset.fields.file['en-US'].url;
  console.log(`Uploaded asset ${label}: ${file.originalname} -> ${url}`);

  return {
    figureIndex,
    url,
    assetId: readyAsset.sys.id,
  };
}

export async function uploadImageAssets(files, meta) {
  const env = await getEnvironment();
  const results = [];
  const concurrency = 3;

  console.log(`Uploading ${files.length} image(s) to Contentful (concurrency: ${concurrency})...`);

  for (let start = 0; start < files.length; start += concurrency) {
    const batch = files.slice(start, start + concurrency);
    const batchMeta = meta.slice(start, start + concurrency);

    const batchResults = await Promise.all(
      batch.map((file, offset) => uploadSingleAsset(
        env,
        file,
        batchMeta[offset] || {},
        `${start + offset + 1}/${files.length}`
      ))
    );

    results.push(...batchResults);
  }

  return results;
}
