'use strict';

const { controller } = require('../server/src/controllers');

describe('checkAvailability controller', () => {
  function createCtx(body) {
    return {
      request: { body },
      body: null,
      badRequest: jest.fn((msg) => {
        throw new Error(msg);
      }),
    };
  }

  function createStrapi(findManyFn) {
    return {
      db: {
        query: jest.fn().mockReturnValue({
          findMany: findManyFn || jest.fn().mockResolvedValue([]),
        }),
      },
    };
  }

  test('returns available: true when slug is free', async () => {
    const strapi = createStrapi();
    const ctrl = controller({ strapi });
    const ctx = createCtx({ slug: 'hello-world', uid: 'api::article.article', field: 'slug' });

    await ctrl.checkAvailability(ctx);

    expect(ctx.body).toEqual({ available: true, suggestion: 'hello-world' });
  });

  test('returns suggestion with -1 when slug is taken', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ slug: 'hello-world' }])
      .mockResolvedValueOnce([]);

    const strapi = createStrapi(findMany);
    const ctrl = controller({ strapi });
    const ctx = createCtx({ slug: 'hello-world', uid: 'api::article.article', field: 'slug' });

    await ctrl.checkAvailability(ctx);

    expect(ctx.body).toEqual({ available: false, suggestion: 'hello-world-1' });
  });

  test('returns suggestion with -2 when -1 is also taken', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ slug: 'test' }])
      .mockResolvedValueOnce([{ slug: 'test-1' }])
      .mockResolvedValueOnce([]);

    const strapi = createStrapi(findMany);
    const ctrl = controller({ strapi });
    const ctx = createCtx({ slug: 'test', uid: 'api::article.article', field: 'slug' });

    await ctrl.checkAvailability(ctx);

    expect(ctx.body).toEqual({ available: false, suggestion: 'test-2' });
  });

  test('excludes documentId from uniqueness check', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const strapi = createStrapi(findMany);
    const ctrl = controller({ strapi });
    const ctx = createCtx({
      slug: 'my-slug',
      uid: 'api::article.article',
      field: 'slug',
      documentId: 'doc-123',
    });

    await ctrl.checkAvailability(ctx);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        slug: 'my-slug',
        documentId: { $ne: 'doc-123' },
      },
      limit: 1,
    });
    expect(ctx.body).toEqual({ available: true, suggestion: 'my-slug' });
  });

  test('returns bad request when slug is missing', async () => {
    const strapi = createStrapi();
    const ctrl = controller({ strapi });
    const ctx = createCtx({ uid: 'api::article.article', field: 'slug' });

    await expect(ctrl.checkAvailability(ctx)).rejects.toThrow('slug, uid, and field are required');
  });

  test('returns bad request when uid is missing', async () => {
    const strapi = createStrapi();
    const ctrl = controller({ strapi });
    const ctx = createCtx({ slug: 'test', field: 'slug' });

    await expect(ctrl.checkAvailability(ctx)).rejects.toThrow('slug, uid, and field are required');
  });

  test('returns bad request when field is missing', async () => {
    const strapi = createStrapi();
    const ctrl = controller({ strapi });
    const ctx = createCtx({ slug: 'test', uid: 'api::article.article' });

    await expect(ctrl.checkAvailability(ctx)).rejects.toThrow('slug, uid, and field are required');
  });
});
