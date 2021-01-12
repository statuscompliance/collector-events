'use strict';

const fetcherUtils = require('./fetcherUtils');

const apiUrl = 'https://www.pivotaltracker.com/services/v5';
const eventType = 'pivotal';

const requestCache = {};

// Function who controls the script flow
const getInfo = (options) => {
  return new Promise((resolve, reject) => {
    getDataPaginated(
      apiUrl + options.endpoint,
      options.token
    ).then((data) => {
      fetcherUtils.applyFilters(
        data,
        options.from,
        options.to,
        options.mustMatch,
        options.endpointType,
        eventType
      ).then(filteredData => {
        resolve(filteredData);
      });
    });
  });
};

// Paginates pivotal data to retrieve everything
const getDataPaginated = (url, token, offset = 0) => {
  return new Promise((resolve, reject) => {
    let requestUrl = url;
    requestUrl += '?limit=100&offset=' + offset;

    const cached = requestCache[requestUrl];

    if (cached !== undefined) {
      if (cached.length !== 0) {
        getDataPaginated(url, token, offset + cached.length).then(recData => {
          resolve(cached.concat(recData));
        }).catch((err) => { reject(err); });
      } else { resolve([]); }
    } else {
      fetcherUtils.requestWithHeaders(requestUrl, { 'X-TrackerToken': token }).then((data) => {
        if (data.length && data.length !== 0) {
          requestCache[requestUrl] = data;
          getDataPaginated(url, token, offset + data.length).then(recData => {
            resolve(data.concat(recData));
          }).catch((err) => { reject(err); });
        } else {
          requestCache[requestUrl] = [];
          resolve([]);
        }
      });
    }
  });
};

exports.getInfo = getInfo;
