'use strict';

const fetcherUtils = require('./fetcherUtils');
const logger = require('governify-commons').getLogger().tag('fetcher-redmine');

const apiUrl = 'http://localhost:81/redmine';
const eventType = 'redmine';

const requestCache = {};

// Function who controls the script flow
const getInfo = (options) => {
  return new Promise((resolve, reject) => {
    getDataPaginated((options.redmineApiBaseUrl || apiUrl) + options.endpoint, options.token).then((data) => {
      fetcherUtils.applyFilters(
        data,
        options.from,
        options.to,
        options.mustMatch,
        options.endpointType,
        eventType
      ).then((filteredData) => {
        if (options.endpointType === 'issuesMovedToInProgress') {
          const result = [];
          const promises = [];

          for (const issue of filteredData) {
            const promise = new Promise((resolve, reject) => {
              try {
                fetcherUtils.requestWithHeaders(apiUrl + '/issues/' + issue.id + '.json?include=journals', { 'X-Redmine-API-Key': options.token }).then(data => {
                  data = Object.values(data)[0];
                  for (const journal of data.journals) {
                    for (const detail of journal.details) {
                      if (detail.name === 'status_id' && detail.new_value === '2') {
                        result.push(data);
                      }
                    }
                  }
                  resolve();
                }).catch(err => {
                  reject(err);
                });
              } catch (err) {
                reject(err);
              }
            });

            promises.push(promise);
          }

          Promise.all(promises).then(() => {
            resolve(result);
          }).catch(err => {
            reject(err);
          });
        } else {
          resolve(filteredData);
        }
      }).catch(err => {
        reject(err);
      });
    }).catch(err => {
      reject(err);
    });
  });
};

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
      fetcherUtils.requestWithHeaders(requestUrl, { 'X-Redmine-API-Key': token }).then((response) => {
        const data = Object.values(response)[0];
        if (data.length && data.length !== 0) {
          requestCache[requestUrl] = data;
          getDataPaginated(url, token, offset + data.length).then(recData => {
            resolve(data.concat(recData));
          }).catch((err) => { reject(err); });
        } else if (typeof data[Symbol.iterator] !== 'function') { // If not iterable
          logger.error('Problem when requesting Redmine payload:\n', data);

          if (data.kind === 'error') {
            if (data.error.includes('The object you tried to access could not be found.')) {
              reject(new Error('Redmine project not found. URL: ' + requestUrl));
            } else if (data.error === 'Authorization failure.') {
              reject(new Error('Unauthorized access to Redmine project. URL: ' + requestUrl));
            } else {
              reject(new Error(data.error + ' URL: ' + requestUrl));
            }
          } else {
            reject(new Error('Redmine unknown problem. URL: ' + requestUrl));
          }
        } else {
          requestCache[requestUrl] = [];
          resolve([]);
        }
      }).catch(err => reject(err));
    }
  });
};

exports.getInfo = getInfo;
