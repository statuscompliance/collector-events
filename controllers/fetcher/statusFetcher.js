"use strict";

require("dotenv").config();

const apiUrl = "http://localhost:1880/api";
const axios = require("axios").default;

// Function who controls the script flow
const getInfo = (options) => {
  let config = { ...options.config };

  const params = new URLSearchParams(config).toString();

  const authConfig = {
    auth: {
      username: process.env.USER_STATUS,
      password: process.env.PASS_STATUS,
    },
  };

  const fullUrl = `${apiUrl}${options.endpoint}?${params}`;

  return axios
    .get(fullUrl, authConfig)
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      console.error("Request failed:", error);
      throw error;
    });
};

exports.getInfo = getInfo;
