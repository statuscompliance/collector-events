const fetcherUtils = require('./fetcherUtils');
const logger = require('governify-commons').getLogger().tag('fetcher-gitlab');

const apiUrl = 'https://gitlab.com/api/v4';
const eventType = 'gitlab';

let requestCache = {};
let cacheDate;

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
        if (options.endpointType === 'closedMRFiles') {
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
              }).catch(err => reject(err));
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
}

const getDataPaginated = (url, token, to, page = 1) => {
  return new Promise((resolve, reject) => {
    let requestUrl = url;
    requestUrl += requestUrl.split('/').pop().includes('?') ? '&per_page=50&page=' + page : '?per_page=50&page=' + page;

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
      const requestConfig = token ? { "PRIVATE-TOKEN": token } : {};
      fetcherUtils.requestWithHeaders(requestUrl, requestConfig).then((data) => {
        if (data.length && data.length !== 0) {
          cacheData(data, requestUrl, to);
          getDataPaginated(url, token, to, page + 1).then(recData => {
            resolve(data.concat(recData));
          }).catch((err) => { reject(err); });
        } else if (typeof data[Symbol.iterator] !== 'function') { // If not iterable
          logger.error('Problem when requesting GH payload:\n', data);

          if (data.message === 'Not Found') {
            reject(new Error('GitLab project not found or unauthorized. URL: ' + requestUrl));
          } else {
            reject(new Error('Problem when requesting to GitLab. URL: ' + requestUrl));
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