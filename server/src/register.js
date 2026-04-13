'use strict';

const register = ({ strapi }) => {
  strapi.customFields.register({
    name: 'slug',
    plugin: 'auto-slug',
    type: 'string',
  });
};

module.exports = { register };
