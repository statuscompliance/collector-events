'use strict';

const fetcherUtils = require('./fetcherUtils');

const apiUrl = 'https://git-wrapper.herokuapp.com';
const eventType = 'ghwrapper';

let requestCache = {};
let cacheDate;

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

    const cached = requestCache[url];

    if (cached !== undefined && cacheDate !== undefined && Date.parse(to) < Date.parse(cacheDate)) {
      resolve(cached);
    } else {
      fetcherUtils.requestWithHeaders(url, {}).then((data) => {
        cacheData(data, url, to);
        resolve(data);
      });
    }
  });
};

const cacheData = (data, requestUrl, to) => {
  if (cacheDate !== undefined && Date.parse(to) < Date.parse(cacheDate)) {
    requestCache[requestUrl] = data;
  } else {
    requestCache = {};
    requestCache[requestUrl] = data;
    cacheDate = new Date().toISOString();
  }
};

exports.getInfo = getInfo;
