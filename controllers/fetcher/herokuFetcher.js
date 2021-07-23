'use strict';

const fetcherUtils = require('./fetcherUtils');
const logger = require('governify-commons').getLogger().tag('fetcher-heroku');

const apiUrl = 'https://api.heroku.com';
const eventType = 'heroku';

const requestCacheUrl = {};
const cacheDateUrl = {};

// Function who controls the script flow
const getInfo = (options) => {
  return new Promise((resolve, reject) => {
    getDataPaginated(apiUrl + options.endpoint, options.token, options.to).then((data) => {
      fetcherUtils.applyFilters(data, options.from, options.to, options.mustMatch, options.endpointType, eventType).then((filteredData) => {
        resolve(filteredData);
      }).catch(err => reject(err));
    }).catch(err => reject(err));
  });
};

// Paginates heroku data to retrieve everything
const getDataPaginated = (url, token, to) => { // TODO - Paginate heroku data
  return new Promise((resolve, reject) => {
    /* let page = 1;
    let paginating = true;
    const allData = [];

    while (paginating) {
      await fetcherUtils
        .requestWithHeaders(url + '?page=' + page, {
          Authorization: token,
          Accept: 'application/vnd.heroku+json; version=3'
        })
        .then((data) => {
          if (data.length && data.length != 0) {
            allData.push.apply(allData, data);
            page++;
          } else {
            paginating = false;
          }
        });
    }

    resolve(allData); */

    const cached = requestCacheUrl[url];
    const cacheDate = cacheDateUrl[url];
    if (cached !== undefined && cacheDate !== undefined && Date.parse(to) < Date.parse(cacheDate)) { resolve(cached); } else {
      fetcherUtils.requestWithHeaders(url, {
        Authorization: token,
        Accept: 'application/vnd.heroku+json; version=3'
      }).then((data) => {
        if (data.length && data.length !== 0) {
          requestCacheUrl[url] = data;
          cacheDateUrl[url] = new Date().toISOString();
          resolve(data);
        } else if (typeof data[Symbol.iterator] !== 'function') { // If not iterable
          logger.error('Problem when requesting Heroku payload:\n', data);

          if (data.id === 'not_found') {
            reject(new Error('Heroku app not found. URL: ' + url));
          } else if (data.id === 'forbidden') {
            reject(new Error('Unauthorized access to Heroku app. URL: ' + url));
          } else if (data.id === 'unauthorized') {
            reject(new Error('No Heroku token or expired one was given. URL: ' + url));
          } else {
            reject(new Error('Unkown Heroku problem. URL: ' + url));
          }
        } else {
          requestCacheUrl[url] = data;
          cacheDateUrl[url] = new Date().toISOString();
          resolve(data);
        }
      }).catch(err => reject(err));
    }
  });
};

exports.getInfo = getInfo;
