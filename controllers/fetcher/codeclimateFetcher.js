'use strict';

const fetcherUtils = require('./fetcherUtils');

const apiUrl = 'https://api.codeclimate.com/v1';
const eventType = 'codeclimate';

let requestCache = {};
let cacheDate;

// Function which controls the script flow
const getInfo = (options) => {
  return new Promise((resolve, reject) => {
    // First we get the cc repository id with the github slug
    getData(apiUrl + '/repos?github_slug=' + options.githubSlug, options.token, options.to).then((repoData) => {
      const repositoryId = repoData.id;
      // Now the endpoint
      getDataPaginated(apiUrl + options.endpoint.replace('[ccRepositoryId]', repositoryId), options.token, options.to).then((data) => {
        // Filters
        fetcherUtils.applyFilters(data, options.from, options.to, options.mustMatch, options.endpointType, eventType).then((filteredData) => {
          resolve(filteredData);
        }).catch(err => {
          reject(err);
        });
      }).catch(err => {
        console.log('Failed when obtaining information for repo ' + options.githubSlug);
        reject(err);
      });
    }).catch((err) => {
      reject(err);
    });
  });
};

const getData = (url, token, to) => {
  return new Promise((resolve, reject) => {
    try {
      const cached = requestCache[url];

      if (cached !== undefined && cacheDate !== undefined && Date.parse(to) < Date.parse(cacheDate)) {
        resolve(cached.data[0]);
      } else {
        fetcherUtils.requestWithHeaders(url, { Authorization: token }).then((data) => {
          if (!data.data[0]) {
            reject(Error('No CC project found or unauthorized. URL: ' + url));
          } else {
            cacheData(data, url, to);
            resolve(data.data[0]);
          }
        }).catch((err) => { reject(err); });
      }
    } catch (err) {
      reject(err);
    }
  });
};

// Paginates github data to retrieve everything
const getDataPaginated = (url, token, to, first = true) => {
  return new Promise((resolve, reject) => {
    try {
      let requestUrl = url;
      if (first) { requestUrl += '?page[size]=100&page[number]=1'; }

      const cached = requestCache[requestUrl];

      if (cached !== undefined && cacheDate !== undefined && Date.parse(to) < Date.parse(cacheDate)) {
        if (cached.links.next) {
          getDataPaginated(cached.links.next, token, to, false).then(recData => {
            resolve(cached.data.concat(recData));
          }).catch((err) => { reject(err); });
        } else {
          resolve(cached.data);
        }
      } else {
        fetcherUtils.requestWithHeaders(requestUrl, { Authorization: token }).then((data) => {
          if (data.errors) {
            console.log(data);
            reject(Error('Error when obtaining CC information. Url: ' + requestUrl));
          } else if (data.links.next) {
            cacheData(data, requestUrl, to);
            getDataPaginated(data.links.next, token, to, false).then(recData => {
              resolve(data.data.concat(recData));
            }).catch((err) => { reject(err); });
          } else {
            cacheData(data, requestUrl, to);
            resolve(data.data);
          }
        }).catch((err) => { reject(err); });
      }
    } catch (err) {
      reject(err);
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
