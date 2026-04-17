'use strict';

const { bootstrap } = require('../server/src/bootstrap');

/**
 * Helper: build a mock strapi instance.
 *
 * @param {Object} contentTypes - map of uid → content-type definition
 * @param {Function} [findManyFn] - custom implementation for db.query().findMany()
 * @param {Function} [findOneFn]  - custom implementation for db.query().findOne()
 */
function createStrapiMock(contentTypes, findManyFn, findOneFn) {
  return {
    contentTypes,
    db: {
      lifecycles: {
        subscribe: jest.fn(),
      },
      query: jest.fn().mockReturnValue({
        findMany: findManyFn || jest.fn().mockResolvedValue([]),
        findOne: findOneFn || jest.fn().mockResolvedValue(null),
      }),
    },
  };
}

// A content-type with one auto-slug field sourced from "title"
const ARTICLE_CONTENT_TYPE = {
  attributes: {
    title: { type: 'string' },
    slug: {
      customField: 'plugin::auto-slug.slug',
      options: { sourceField: 'title' },
    },
  },
};

// A content-type with two auto-slug fields
const MULTI_SLUG_CONTENT_TYPE = {
  attributes: {
    title: { type: 'string' },
    name: { type: 'string' },
    titleSlug: {
      customField: 'plugin::auto-slug.slug',
      options: { sourceField: 'title' },
    },
    nameSlug: {
      customField: 'plugin::auto-slug.slug',
      options: { sourceField: 'name' },
    },
  },
};

// A content-type with no slug fields
const PLAIN_CONTENT_TYPE = {
  attributes: {
    title: { type: 'string' },
    body: { type: 'richtext' },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bootstrap – lifecycle subscription', () => {
  test('subscribes to content-types that have auto-slug fields', () => {
    const strapi = createStrapiMock({
      'api::article.article': ARTICLE_CONTENT_TYPE,
    });

    bootstrap({ strapi });

    expect(strapi.db.lifecycles.subscribe).toHaveBeenCalledTimes(1);
    expect(strapi.db.lifecycles.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        models: ['api::article.article'],
        beforeCreate: expect.any(Function),
        beforeUpdate: expect.any(Function),
      })
    );
  });

  test('does not subscribe for content-types without slug fields', () => {
    const strapi = createStrapiMock({
      'api::page.page': PLAIN_CONTENT_TYPE,
    });

    bootstrap({ strapi });

    expect(strapi.db.lifecycles.subscribe).not.toHaveBeenCalled();
  });

  test('subscribes separately per content-type', () => {
    const strapi = createStrapiMock({
      'api::article.article': ARTICLE_CONTENT_TYPE,
      'api::page.page': PLAIN_CONTENT_TYPE,
      'api::product.product': {
        attributes: {
          name: { type: 'string' },
          handle: {
            customField: 'plugin::auto-slug.slug',
            options: { sourceField: 'name' },
          },
        },
      },
    });

    bootstrap({ strapi });

    expect(strapi.db.lifecycles.subscribe).toHaveBeenCalledTimes(2);
    expect(strapi.db.lifecycles.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ models: ['api::article.article'] })
    );
    expect(strapi.db.lifecycles.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ models: ['api::product.product'] })
    );
  });

  test('ignores slug fields that have no sourceField option', () => {
    const strapi = createStrapiMock({
      'api::article.article': {
        attributes: {
          title: { type: 'string' },
          slug: {
            customField: 'plugin::auto-slug.slug',
            // no options.sourceField
          },
        },
      },
    });

    bootstrap({ strapi });

    expect(strapi.db.lifecycles.subscribe).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// slugify (tested indirectly through beforeCreate)
// ---------------------------------------------------------------------------

describe('slugify – slug generation via beforeCreate', () => {
  /** Helper to run beforeCreate and return the mutated data */
  async function runBeforeCreate(data, findManyFn) {
    const strapi = createStrapiMock({ 'api::article.article': ARTICLE_CONTENT_TYPE }, findManyFn);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = { params: { data } };
    await hook(event);
    return event.params.data;
  }

  test('generates slug from source field', async () => {
    const data = await runBeforeCreate({ title: 'Hello World' });
    expect(data.slug).toBe('hello-world');
  });

  test('converts to lowercase', async () => {
    const data = await runBeforeCreate({ title: 'UPPER CASE' });
    expect(data.slug).toBe('upper-case');
  });

  test('strips diacritics', async () => {
    const data = await runBeforeCreate({ title: 'Café Résumé' });
    expect(data.slug).toBe('cafe-resume');
  });

  test('removes special characters', async () => {
    const data = await runBeforeCreate({ title: 'My Blog Post!' });
    expect(data.slug).toBe('my-blog-post');
  });

  test('replaces spaces and underscores with hyphens', async () => {
    const data = await runBeforeCreate({ title: 'hello_world test' });
    expect(data.slug).toBe('hello-world-test');
  });

  test('collapses multiple spaces', async () => {
    const data = await runBeforeCreate({ title: 'Multiple   Spaces' });
    expect(data.slug).toBe('multiple-spaces');
  });

  test('trims leading and trailing hyphens', async () => {
    const data = await runBeforeCreate({ title: '--Leading & Trailing--' });
    expect(data.slug).toBe('leading-trailing');
  });

  test('handles ampersands and symbols', async () => {
    const data = await runBeforeCreate({ title: 'Rock & Roll @ Night!' });
    expect(data.slug).toBe('rock-roll-night');
  });

  test('does not set slug when source field is empty string', async () => {
    const data = await runBeforeCreate({ title: '' });
    expect(data.slug).toBeUndefined();
  });

  test('does not set slug when source field is missing', async () => {
    const data = await runBeforeCreate({});
    expect(data.slug).toBeUndefined();
  });

  test('handles string of only special characters', async () => {
    const data = await runBeforeCreate({ title: '!@#$%^&*()' });
    expect(data.slug).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findUniqueSlug (tested through beforeCreate)
// ---------------------------------------------------------------------------

describe('findUniqueSlug – uniqueness via beforeCreate', () => {
  test('returns slug as-is when no duplicates exist', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const strapi = createStrapiMock({ 'api::article.article': ARTICLE_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = { params: { data: { title: 'Unique Title' } } };
    await hook(event);

    expect(event.params.data.slug).toBe('unique-title');
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  test('appends -1 when slug already exists', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ slug: 'hello-world' }]) // "hello-world" taken
      .mockResolvedValueOnce([]); // "hello-world-1" free

    const strapi = createStrapiMock({ 'api::article.article': ARTICLE_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = { params: { data: { title: 'Hello World' } } };
    await hook(event);

    expect(event.params.data.slug).toBe('hello-world-1');
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  test('appends -2 when -1 is also taken', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ slug: 'hello-world' }])
      .mockResolvedValueOnce([{ slug: 'hello-world-1' }])
      .mockResolvedValueOnce([]);

    const strapi = createStrapiMock({ 'api::article.article': ARTICLE_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = { params: { data: { title: 'Hello World' } } };
    await hook(event);

    expect(event.params.data.slug).toBe('hello-world-2');
    expect(findMany).toHaveBeenCalledTimes(3);
  });

  test('excludes own documentId from uniqueness check', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const strapi = createStrapiMock({ 'api::article.article': ARTICLE_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = {
      params: {
        data: { title: 'Test', documentId: 'doc-123' },
      },
    };
    await hook(event);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        slug: 'test',
        documentId: { $ne: 'doc-123' },
      },
      limit: 1,
    });
  });

  test('ensures uniqueness when slug is provided directly', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ slug: 'my-custom-slug' }])
      .mockResolvedValueOnce([]);

    const strapi = createStrapiMock({ 'api::article.article': ARTICLE_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = {
      params: { data: { title: 'Ignored', slug: 'my-custom-slug' } },
    };
    await hook(event);

    expect(event.params.data.slug).toBe('my-custom-slug-1');
  });

  test('uses provided slug over generating from source when both present', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const strapi = createStrapiMock({ 'api::article.article': ARTICLE_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = {
      params: { data: { title: 'Source Title', slug: 'custom-slug' } },
    };
    await hook(event);

    // Should use the provided slug, not generate from title
    expect(event.params.data.slug).toBe('custom-slug');
  });
});

// ---------------------------------------------------------------------------
// beforeUpdate
// ---------------------------------------------------------------------------

describe('beforeUpdate', () => {
  function setupUpdate(findManyFn, findOneFn) {
    const strapi = createStrapiMock(
      { 'api::article.article': ARTICLE_CONTENT_TYPE },
      findManyFn,
      findOneFn
    );

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeUpdate;
    return { strapi, hook };
  }

  test('checks uniqueness when slug changes', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const findOne = jest.fn().mockResolvedValue({
      id: 1,
      documentId: 'doc-1',
      slug: 'old-slug',
    });

    const { hook } = setupUpdate(findMany, findOne);
    const event = {
      params: {
        data: { slug: 'new-slug' },
        where: { id: 1 },
      },
    };
    await hook(event);

    expect(findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        slug: 'new-slug',
        documentId: { $ne: 'doc-1' },
      },
      limit: 1,
    });
    expect(event.params.data.slug).toBe('new-slug');
  });

  test('appends suffix when new slug conflicts', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([{ slug: 'taken-slug' }])
      .mockResolvedValueOnce([]);

    const findOne = jest.fn().mockResolvedValue({
      id: 1,
      documentId: 'doc-1',
      slug: 'old-slug',
    });

    const { hook } = setupUpdate(findMany, findOne);
    const event = {
      params: {
        data: { slug: 'taken-slug' },
        where: { id: 1 },
      },
    };
    await hook(event);

    expect(event.params.data.slug).toBe('taken-slug-1');
  });

  test('skips uniqueness check when slug is unchanged', async () => {
    const findMany = jest.fn();
    const findOne = jest.fn().mockResolvedValue({
      id: 1,
      documentId: 'doc-1',
      slug: 'same-slug',
    });

    const { hook } = setupUpdate(findMany, findOne);
    const event = {
      params: {
        data: { slug: 'same-slug' },
        where: { id: 1 },
      },
    };
    await hook(event);

    expect(findMany).not.toHaveBeenCalled();
    expect(event.params.data.slug).toBe('same-slug');
  });

  test('skips processing when slug is not in update data', async () => {
    const findMany = jest.fn();
    const findOne = jest.fn();

    const { hook } = setupUpdate(findMany, findOne);
    const event = {
      params: {
        data: { title: 'Updated Title' },
        where: { id: 1 },
      },
    };
    await hook(event);

    expect(findOne).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  test('skips processing when where.id is missing', async () => {
    const findMany = jest.fn();
    const findOne = jest.fn();

    const { hook } = setupUpdate(findMany, findOne);
    const event = {
      params: {
        data: { slug: 'new-slug' },
        where: {},
      },
    };
    await hook(event);

    expect(findOne).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  test('skips processing when entry is not found', async () => {
    const findMany = jest.fn();
    const findOne = jest.fn().mockResolvedValue(null);

    const { hook } = setupUpdate(findMany, findOne);
    const event = {
      params: {
        data: { slug: 'new-slug' },
        where: { id: 99 },
      },
    };
    await hook(event);

    expect(findMany).not.toHaveBeenCalled();
    expect(event.params.data.slug).toBe('new-slug');
  });
});

// ---------------------------------------------------------------------------
// Multiple slug fields
// ---------------------------------------------------------------------------

describe('multiple slug fields on a single content-type', () => {
  test('generates slugs for all slug fields independently', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const strapi = createStrapiMock({ 'api::product.product': MULTI_SLUG_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = {
      params: {
        data: { title: 'Product Title', name: 'Product Name' },
      },
    };
    await hook(event);

    expect(event.params.data.titleSlug).toBe('product-title');
    expect(event.params.data.nameSlug).toBe('product-name');
  });

  test('handles one slug provided and one generated', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const strapi = createStrapiMock({ 'api::product.product': MULTI_SLUG_CONTENT_TYPE }, findMany);

    bootstrap({ strapi });

    const hook = strapi.db.lifecycles.subscribe.mock.calls[0][0].beforeCreate;
    const event = {
      params: {
        data: {
          title: 'Product Title',
          name: 'Product Name',
          titleSlug: 'custom-title-slug',
        },
      },
    };
    await hook(event);

    expect(event.params.data.titleSlug).toBe('custom-title-slug');
    expect(event.params.data.nameSlug).toBe('product-name');
  });
});

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

describe('register', () => {
  const { register } = require('../server/src/register');

  test('registers the custom field', () => {
    const strapi = {
      customFields: {
        register: jest.fn(),
      },
    };

    register({ strapi });

    expect(strapi.customFields.register).toHaveBeenCalledWith({
      name: 'slug',
      plugin: 'auto-slug',
      type: 'string',
    });
  });
});
