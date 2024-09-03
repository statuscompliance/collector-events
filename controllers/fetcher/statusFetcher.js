"use strict";

require("dotenv").config();

const apiUrl = process.env.NODE_RED_URL || "http://node-red-status:1880/api";

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

  let fullUrl = `${apiUrl}${options.endpoint}`;

  try {
    if (requestBody.Status === "true") {
      fullUrl = `${fullUrl}?Status=true`;
    }
    const response = await axios.post(fullUrl, requestBody, authConfig);
    console.log("Full URL:", fullUrl);
    console.log("Request success:", JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error("Request failed:", error);
    throw error;
  }
};

exports.getInfo = getInfo;
