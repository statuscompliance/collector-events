'use strict';

const fetcherUtils = require('./fetcherUtils');
const logger = require('governify-commons').getLogger().tag('fetcher-github-ci');

const apiUrl = 'https://api.github.com';
const eventType = 'githubCI';

let requestCache = {};
let cacheDate;

// Function who controls the script flow
const getInfo = (options) => {
  return new Promise((resolve, reject) => {
    getDataPaginated(apiUrl + options.endpoint, options.token, options.to).then((data) => {
      fetcherUtils.applyFilters(
        data,
        options.from,
        options.to,
        options.mustMatch,
        options.endpointType,
        eventType
      ).then((filteredData) => {
        // TODO - Generalyze
        resolve(filteredData);
      }).catch(err => reject(err));
    }).catch(err => {
      reject(err);
    });
  });
};

// Paginates github data to retrieve everything
const getDataPaginated = (url, token, to, page = 1) => {
  return new Promise((resolve, reject) => {
    let requestUrl = url;
    requestUrl += requestUrl.split('/').pop().includes('?') ? '&page=' + page : '?page=' + page;

    const cached = requestCache[requestUrl];

    if (cached !== undefined && cacheDate !== undefined && Date.parse(to) < Date.parse(cacheDate)) {
      if (cached.length !== 0) {
        getDataPaginated(url, token, to, page + 1).then(recData => {
          resolve(cached.concat(recData));
        }).catch((err) => { reject(err); });
      } else {
        resolve([]);
      }
    } else {
      const requestConfig = token ? { Authorization: token } : {};
      fetcherUtils.requestWithHeaders(requestUrl, requestConfig).then((response) => {
        const data = response.workflow_runs;
        if (data.length && data.length !== 0) {
          cacheData(data, requestUrl, to);
          getDataPaginated(url, token, to, page + 1).then(recData => {
            resolve(data.concat(recData));
          }).catch((err) => { reject(err); });
        } else if (typeof data[Symbol.iterator] !== 'function') { // If not iterable
          logger.error('Problem when requesting GH payload:\n', data);

          if (data.message === 'Not Found') {
            reject(new Error('GitHub project not found or unauthorized. URL: ' + requestUrl));
          } else {
            reject(new Error('Problem when requesting to GitHub. URL: ' + requestUrl));
          }
        } else {
          cacheData([], requestUrl, to);
          resolve([]);
        }
      }).catch((err) => { reject(err); });
    }
  });
};

const cacheData = (data, requestUrl, to) => {
  if (cacheDate !== undefined && Date.parse(to) < Date.parse(cacheDate)) { requestCache[requestUrl] = data; } else {
    requestCache = {};
    requestCache[requestUrl] = data;
    cacheDate = new Date().toISOString();
  }
};

exports.getInfo = getInfo;
