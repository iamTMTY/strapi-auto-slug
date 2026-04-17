'use strict';

const { register } = require('./register');
const { bootstrap } = require('./bootstrap');
const routes = require('./routes');
const { controller } = require('./controllers');

module.exports = {
  register,
  bootstrap,
  routes,
  controllers: {
    controller,
  },
};
