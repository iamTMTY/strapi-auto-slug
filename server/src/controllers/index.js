'use strict';

const controller = ({ strapi }) => ({
  async checkAvailability(ctx) {
    const { slug, uid, field, documentId } = ctx.request.body;

    if (!slug || !uid || !field) {
      return ctx.badRequest('slug, uid, and field are required');
    }

    const where = { [field]: slug };
    if (documentId) {
      where.documentId = { $ne: documentId };
    }

    let candidate = slug;
    let counter = 1;

    while (true) {
      const existing = await strapi.db.query(uid).findMany({
        where: { ...where, [field]: candidate },
        limit: 1,
      });

      if (existing.length === 0) {
        ctx.body = { available: candidate === slug, suggestion: candidate };
        return;
      }

      candidate = `${slug}-${counter}`;
      counter++;
    }
  },
});

module.exports = { controller };
