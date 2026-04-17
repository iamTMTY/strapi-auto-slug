'use strict';

module.exports = [
  {
    method: 'POST',
    path: '/check-availability',
    handler: 'controller.checkAvailability',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
];
