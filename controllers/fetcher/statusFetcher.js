"use strict";

require("dotenv").config();

const apiUrl = "http://localhost:1880/api";
const axios = require("axios").default;

// Function who controls the script flow
const getInfo = async (options) => {
  const authConfig = {
    auth: {
      username: process.env.USER_STATUS,
      password: process.env.PASS_STATUS,
    },
  };

  const requestBody = { ...options.config };

  const fullUrl = `${apiUrl}${options.endpoint}`;

  try {
    const response = await axios.post(fullUrl, requestBody, authConfig);
    return response.data;
  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
};

exports.getInfo = getInfo;
