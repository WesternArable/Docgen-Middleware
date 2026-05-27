const { normalizeBinary } = require('./salesforceService');
const { createValidationError } = require('./validationService');
const { imageSize: detectImageSize } = require('image-size');

function decodeDataUriImage(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

function createImageModule(payload, imageById = {}) {
  let ImageModule;
  try {
    ImageModule = require('docxtemplater-image-module-free');
  } catch (_error) {
    throw createValidationError(
      'Image module is not installed. Run: npm install docxtemplater-image-module-free'
    );
  }

  const requestedSize = payload?.header?.imageSize;
  const requestedLogoSize = payload?.header?.logoSize ?? payload?.logoSize;
  const requestedSizes = payload?.header?.imageSizes;

  function normalizeSize(size) {
    if (!Array.isArray(size) || size.length !== 2) return null;
    const width = Number(size[0]);
    const height = Number(size[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return [width, height];
  }

  const imageSize = normalizeSize(requestedSize);
  const logoSize = normalizeSize(requestedLogoSize);

  function resolvePerImageSize(tagName, tagValue) {
    if ((tagName === 'header_logo' || tagName === 'header_logo_id') && logoSize) {
      return logoSize;
    }
    if (!requestedSizes || typeof requestedSizes !== 'object') return null;

    const byTag = normalizeSize(requestedSizes[tagName]);
    if (byTag) return byTag;

    if (typeof tagName === 'string') {
      const indexMatch = tagName.match(/(\d+)$/);
      if (indexMatch) {
        const byIndex = normalizeSize(requestedSizes[indexMatch[1]]);
        if (byIndex) return byIndex;
      }
    }

    if (typeof tagValue === 'string') {
      const byId = normalizeSize(requestedSizes[tagValue]);
      if (byId) return byId;
    }

    return null;
  }

  return new ImageModule({
    centered: false,
    getImage(tagValue) {
      if (typeof tagValue === 'string' && imageById[tagValue]) {
        return imageById[tagValue];
      }
      const binary = normalizeBinary(tagValue);
      if (binary && binary.length > 0) return binary;
      const dataUri = decodeDataUriImage(tagValue);
      if (dataUri) return dataUri;
      return Buffer.alloc(0);
    },
    getSize(imgBuffer, tagValue, tagName) {
      const perImage = resolvePerImageSize(tagName, tagValue);
      if (perImage) return perImage;

      if (imageSize) return imageSize;

      try {
        const detected = detectImageSize(imgBuffer);
        if (detected?.width && detected?.height) {
          return [detected.width, detected.height];
        }
      } catch (_error) {
        console.error('Error detecting image size:', _error);
      }

      return [120, 40];
    },
  });
}

module.exports = { createImageModule };
