const { downloadContentVersion, downloadStaticResourceByName } = require('./salesforceService');

function resolveHeaderContext(payload) {
  const header = payload?.header && typeof payload.header === 'object'
    ? payload.header
    : {};

  const showHeader = header.show ?? payload?.showHeader ?? true;
  const logoOnly = header.logoOnly ?? payload?.headerLogoOnly ?? false;
  const rawImageIds = header.imageIds ?? payload?.headerImageIds ?? [];
  const rawImageStaticResourceNames =
    header.imageStaticResourceNames ??
    payload?.headerImageStaticResourceNames ??
    [];
  const logoIdRaw = header.logoId ?? payload?.headerLogoId ?? '';
  const logoStaticResourceNameRaw =
    header.logoStaticResourceName ??
    payload?.headerLogoStaticResourceName ??
    '';
  const logoId = typeof logoIdRaw === 'string' ? logoIdRaw.trim() : '';
  const logoStaticResourceName =
    typeof logoStaticResourceNameRaw === 'string'
      ? logoStaticResourceNameRaw.trim()
      : '';

  const imageIds = Array.isArray(rawImageIds)
    ? rawImageIds
    : typeof rawImageIds === 'string' && rawImageIds.trim()
      ? rawImageIds.split(',').map((v) => v.trim()).filter(Boolean)
      : [];
  const imageStaticResourceNames = Array.isArray(rawImageStaticResourceNames)
    ? rawImageStaticResourceNames
    : typeof rawImageStaticResourceNames === 'string' && rawImageStaticResourceNames.trim()
      ? rawImageStaticResourceNames.split(',').map((v) => v.trim()).filter(Boolean)
      : [];

  const imageTokens = [
    ...imageIds.map((id) => ({ token: id, source: 'contentVersion' })),
    ...imageStaticResourceNames.map((name) => ({ token: `sr:${name}`, source: 'staticResource' })),
  ];
  const indexedImages = imageTokens.map((entry, index) => ({
    index: index + 1,
    id: entry.token,
    source: entry.source,
  }));
  const dynamicImageKeys = {};
  indexedImages.forEach(({ index, id }) => {
    dynamicImageKeys[`header_image_${index}`] = id;
  });

  const normalizedShowHeader = Boolean(showHeader);
  const normalizedLogoOnly = Boolean(logoOnly);

  return {
    header_show: normalizedShowHeader,
    header_logo_only: normalizedShowHeader && normalizedLogoOnly,
    header_show_full: normalizedShowHeader && !normalizedLogoOnly,
    header_logo_id: logoId,
    header_logo_static_resource_name: logoStaticResourceName,
    header_logo: logoStaticResourceName ? `sr:${logoStaticResourceName}` : logoId,
    header_image_ids: imageIds,
    header_image_static_resource_names: imageStaticResourceNames,
    header_images: indexedImages,
    ...dynamicImageKeys,
  };
}

async function resolveHeaderImages(headerContext, env) {
  const imageIds = Array.isArray(headerContext?.header_image_ids)
    ? headerContext.header_image_ids
    : [];
  const logoId = typeof headerContext?.header_logo_id === 'string'
    ? headerContext.header_logo_id
    : '';
  const logoStaticResourceName = typeof headerContext?.header_logo_static_resource_name === 'string'
    ? headerContext.header_logo_static_resource_name
    : '';
  const imageStaticResourceNames = Array.isArray(headerContext?.header_image_static_resource_names)
    ? headerContext.header_image_static_resource_names
    : [];
  const contentVersionTokens = [...imageIds, logoId].filter(Boolean);
  const staticResourceTokens = [
    ...imageStaticResourceNames.map((name) => `sr:${name}`),
    ...(logoStaticResourceName ? [`sr:${logoStaticResourceName}`] : []),
  ];
  const allIds = [...contentVersionTokens, ...staticResourceTokens].filter(Boolean);

  if (allIds.length === 0) {
    return { headerContext, imageById: {} };
  }

  const uniqueIds = Array.from(new Set(allIds));
  const imageById = {};
  await Promise.all(
    uniqueIds.map(async (id) => {
      if (id.startsWith('sr:')) {
        imageById[id] = await downloadStaticResourceByName(id.slice(3), env);
      } else {
        imageById[id] = await downloadContentVersion(id, env);
      }
    })
  );

  return {
    headerContext: {
      ...headerContext,
      header_images: (headerContext.header_images || []).map((entry) => ({
        ...entry,
        image_id: entry.id,
      })),
    },
    imageById,
  };
}

module.exports = { resolveHeaderContext, resolveHeaderImages };
