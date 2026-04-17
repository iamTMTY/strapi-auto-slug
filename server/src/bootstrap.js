'use strict';

/**
 * Convert text to a URL-friendly slug.
 * Handles Unicode characters by normalizing diacritics.
 */
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens from edges
}

/**
 * Find a unique slug by appending an incrementing suffix if needed.
 *
 * In Strapi v5 a single document can have multiple DB rows (draft, published,
 * per-locale). Uniqueness is checked across *documents*, not rows — rows that
 * share the same documentId are treated as one entity.
 */
async function findUniqueSlug(strapi, uid, slugField, baseSlug, excludeDocumentId) {
  let candidate = baseSlug;
  let counter = 1;

  while (true) {
    const where = { [slugField]: candidate };
    if (excludeDocumentId) {
      where.documentId = { $ne: excludeDocumentId };
    }

    const existing = await strapi.db.query(uid).findMany({ where, limit: 1 });

    if (existing.length === 0) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Scan all content-types for auto-slug fields and subscribe to their
 * lifecycle events to ensure slug uniqueness.
 *
 * Slug generation is handled client-side in the admin Input component.
 * The server only ensures uniqueness and provides a fallback for API calls.
 */
const bootstrap = ({ strapi }) => {
  const contentTypes = strapi.contentTypes;

  for (const [uid, contentType] of Object.entries(contentTypes)) {
    const slugFields = {};

    for (const [attrName, attr] of Object.entries(contentType.attributes || {})) {
      if (attr.customField === 'plugin::auto-slug.slug') {
        const sourceField = attr.options?.sourceField;
        if (sourceField) {
          slugFields[attrName] = sourceField;
        }
      }
    }

    if (Object.keys(slugFields).length === 0) continue;

    strapi.db.lifecycles.subscribe({
      models: [uid],

      async beforeCreate(event) {
        const { data } = event.params;
        const documentId = data.documentId;

        for (const [slugField, sourceField] of Object.entries(slugFields)) {
          if (data[slugField]) {
            // Slug provided (from admin or API) — ensure uniqueness
            data[slugField] = await findUniqueSlug(
              strapi,
              uid,
              slugField,
              data[slugField],
              documentId
            );
          } else if (data[sourceField]) {
            // Fallback for API calls without the admin panel
            const baseSlug = slugify(data[sourceField]);
            if (baseSlug) {
              data[slugField] = await findUniqueSlug(strapi, uid, slugField, baseSlug, documentId);
            }
          }
        }
      },

      async beforeUpdate(event) {
        const { data, where } = event.params;

        for (const [slugField] of Object.entries(slugFields)) {
          if (data[slugField] && where?.id) {
            const current = await strapi.db.query(uid).findOne({
              where: { id: where.id },
            });
            if (current && data[slugField] !== current[slugField]) {
              data[slugField] = await findUniqueSlug(
                strapi,
                uid,
                slugField,
                data[slugField],
                current.documentId
              );
            }
          }
        }
      },
    });
  }
};

module.exports = { bootstrap };
