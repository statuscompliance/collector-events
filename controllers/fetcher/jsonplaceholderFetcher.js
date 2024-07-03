'use strict';

const apiUrl = 'https://jsonplaceholder.typicode.com';
const axios = require("axios").default;

// Function who controls the script flow
const getInfo = (options) => {
  return axios.get(apiUrl + options.endpoint).then((data) => data.data)
};

exports.getInfo = getInfo;
