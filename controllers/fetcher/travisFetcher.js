"use strict";

const fetcherUtils = require("./fetcherUtils");
const logger = require("governify-commons").getLogger().tag("fetcher-travis");

const publicApiUrl = "https://api.travis-ci.org";
const privateApiUrl = "https://api.travis-ci.com";
const eventType = "travis";

let requestCache = {};
let cacheDate;

// Function who controls the script flow
const getInfo = (options) => {
  return new Promise((resolve, reject) => {
    // Get data depending if public or private
    getDataPaginated(
      options.public
        ? publicApiUrl + options.endpoint
        : privateApiUrl + options.endpoint,
      options.token,
      options.to
    )
      .then((data) => {
        fetcherUtils
          .applyFilters(
            data,
            options.from,
            options.to,
            options.mustMatch,
            options.endpointType,
            eventType
          )
          .then((filteredData) => {
            resolve(filteredData);
          })
          .catch((err) => {
            reject(err);
          });
      })
      .catch((err) => {
        reject(err);
      });
  });
};

// Paginates travis data to retrieve everything
const getDataPaginated = (url, token, to, offset = 0) => {
  return new Promise((resolve, reject) => {
    let requestUrl = url;
    requestUrl += "?limit=100&offset=" + offset;

    const cached = requestCache[requestUrl];

    if (
      cached !== undefined &&
      cacheDate !== undefined &&
      Date.parse(to) < Date.parse(cacheDate)
    ) {
      if (cached.error_message) {
        reject(Error("Travis API response: " + cached.error_message));
      }
      const pagination = { ...cached["@pagination"] };
      // Finds the dataArray
      let arrayName = "";
      Object.keys(cached).forEach((x) => {
        if (!x.includes("@")) arrayName = x;
      });

      // Resolves Data recursing if needed
      if (pagination.offset + pagination.limit < pagination.count) {
        getDataPaginated(url, token, to, offset + pagination.limit)
          .then((recData) => {
            resolve(cached[arrayName].concat(recData));
          })
          .catch((err) => {
            reject(err);
          });
      } else {
        resolve(cached[arrayName]);
      }
    } else {
      fetcherUtils
        .requestWithHeaders(requestUrl, {
          Authorization: token,
          "Travis-API-Version": 3,
        })
        .then((data) => {
          if (data["@type"] === "error") {
            logger.error("Problem when requesting PT payload:\n", data);

            if (data.error_type === "not_found") {
              reject(
                Error(
                  "Non existent or unauthorized access to Travis repo. URL: " +
                    requestUrl
                )
              );
            } else {
              reject(
                Error(
                  "Unknown problem when requesting to Travis. URL: " +
                    requestUrl
                )
              );
            }
          } else if (data === "access denied") {
            reject(
              Error(
                "No travis token or invalid one was given. URL: " + requestUrl
              )
            );
          } else {
            const pagination = data["@pagination"];
            // Finds the dataArray
            let arrayName = "";
            Object.keys(data).forEach((x) => {
              if (!x.includes("@")) arrayName = x;
            });

            // Resolves Data recursing if needed
            if (pagination.offset + pagination.limit < pagination.count) {
              cacheData(data, requestUrl, to);
              getDataPaginated(url, token, to, offset + pagination.limit)
                .then((recData) => {
                  resolve(data[arrayName].concat(recData));
                })
                .catch((err) => {
                  reject(err);
                });
            } else {
              cacheData(data, requestUrl, to);
              resolve(data[arrayName]);
            }
          }
        })
        .catch((err) => {
          reject(err);
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
