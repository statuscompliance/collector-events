'use strict';

const fetcherUtils = require('./fetcherUtils');

const apiUrl = 'https://api.github.com';
const eventType = 'github';

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
        if (options.endpointType === 'closedPRFiles') {
          const result = [];
          const promises = [];

          for (const closedPR of filteredData) {
            const promise = new Promise((resolve, reject) => {
              try {
                getDataPaginated(apiUrl + options.endpoint.split('?')[0] + '/' + closedPR.number + '/files', options.token, options.to).then(closedPRFiles => {
                  closedPRFiles[0].closed_at = closedPR.closed_at; // Add the date for the matches
                  result.push(closedPRFiles[0]);
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
            let secondMustMatch = options.mustMatch;

            if (JSON.stringify(secondMustMatch).includes('%SECOND%')) {
              // Matching filter generation with only %SECOND% strings
              secondMustMatch = getSecondMustMatch(options.mustMatch);
              // Apply new filter
              fetcherUtils.applyFilters(
                result,
                options.from,
                options.to,
                secondMustMatch,
                options.endpointType,
                eventType
              ).then(finalResult => {
                resolve(finalResult);
              });
            } else {
              resolve(result);
            }
          }).catch(err => {
            reject(err);
          });
        } else {
          resolve(filteredData);
        }
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
      fetcherUtils.requestWithHeaders(requestUrl, { Authorization: token }).then((data) => {
        if (data.length && data.length !== 0) {
          cacheData(data, requestUrl, to);
          getDataPaginated(url, token, to, page + 1).then(recData => {
            resolve(data.concat(recData));
          }).catch((err) => { reject(err); });
        } else if (typeof data[Symbol.iterator] !== 'function') { // If not iterable
          console.log('Problem when requesting GH payload:\n', data);

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

const getSecondMustMatch = (mustMatch) => {
  try {
    const copy = { ...mustMatch };
    for (const key of Object.keys(mustMatch)) {
      if (typeof copy[key] === typeof {}) {
        copy[key] = getSecondMustMatch(copy[key]);
        if (Object.keys(copy[key]).length === 0) {
          delete copy[key];
        }
      } else if (typeof copy[key] === typeof '') {
        if (copy[key].includes('%SECOND%')) {
          copy[key] = copy[key].split('%SECOND%')[1];
        } else {
          delete copy[key];
        }
      } else {
        delete copy[key];
      }
    }
    return copy;
  } catch (err) {
    console.log(err);
    return {};
  }
};

exports.getInfo = getInfo;
