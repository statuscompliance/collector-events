"use strict";

const fs = require("fs");

const configJSON = JSON.parse(
  fs.readFileSync("./configurations/sourcesManager.json")
);
const logger = require("governify-commons").getLogger().tag("sources-manager");

exports.getEndpoint = (eventType, endpointType, integrations) => {
  try {
    const endpointsJSON = { ...configJSON.endpoints };
    let endpoint = endpointsJSON[eventType][endpointType].endpoint;

    // Obtains all {ANY} strings
    const re = /\{([A-z]|\.)+\}/g;
    const endpointIntegrations = endpoint.match(re) ? endpoint.match(re) : [];

    // Substituting endpoint parameters with integrations object
    for (const integration of endpointIntegrations) {
      const integrationSplit = integration
        .replace("{", "")
        .replace("}", "")
        .split(".");

      if (
        Object.keys(integrations).includes("gitlab") &&
        integrationSplit[0] === "github"
      )
        integrationSplit[0] = "gitlab";
      endpoint = endpoint.replace(
        integration,
        integrations[integrationSplit[0]][integrationSplit[1]]
      );
    }

    return endpoint;
  } catch (err) {
    logger.error("sourcesManager.getEndpoint:\n", err);
    return undefined;
  }
};

exports.getMustMatch = (json, integrations, member) => {
  try {
    const substitutionsList = [...configJSON.substitutions];
    let mustMatch = { ...json };

    // Integrations substitutions
    for (const substitution of substitutionsList) {
      const substitutionSplit = substitution.split("->");
      const integrationSplit = substitutionSplit[1].split(".");
      if (JSON.stringify(mustMatch).includes(substitutionSplit[0])) {
        mustMatch = JSON.parse(
          JSON.stringify(mustMatch).replace(
            "%" + substitutionSplit[0] + "%",
            integrations[integrationSplit[0]][integrationSplit[1]]
          )
        );
      }
    }

    // Member substitutions
    /// Find all matches %USER.SOURCE%
    const re = /%MEMBER[.]\w{1,}%/g;
    let keepGoing = true;
    const matches = [];

    while (keepGoing) {
      const last = re.exec(JSON.stringify(mustMatch));
      if (last === null) {
        keepGoing = false;
      } else {
        matches.push(last[0]);
      }
    }

    // Substitute
    for (const match of matches) {
      if (member) {
        const source = match.replace(/%/g, "").split(".")[1];
        for (const identity of member.identities) {
          if (identity.source === source) {
            mustMatch = JSON.parse(
              JSON.stringify(mustMatch).replace(match, identity.username)
            );
          }
        }
      } else {
        mustMatch = JSON.parse(
          JSON.stringify(mustMatch).replace(match, "%ANYTHING%")
        );
      }
    }

    return mustMatch;
  } catch (err) {
    logger.error("sourcesManager.getMustMatch:\n", err);
    return undefined;
  }
};

exports.getEventDate = (eventType, endpointType, event) => {
  try {
    if (endpointType === "custom") {
      return event?.payloadDate;
    } else {
      const payloadDatesJSON = { ...configJSON.endpoints };
      const split =
        payloadDatesJSON[eventType][endpointType].payloadDate.split(".");

      // Iterative extraction of event date based on the endpoint payloadDate configuration
      let eventDate = event;
      for (let i = 0; i < split.length; i++) {
        eventDate = eventDate[split[i]];
      }

      if (eventDate === undefined) {
        throw new Error(
          "SourcesManager.getEventDate - Not found attribute in payload (eventType/endpointType: " +
            eventType +
            "/" +
            endpointType +
            "-> Attribute: " +
            payloadDatesJSON[eventType][endpointType].payloadDate +
            ").\n" +
            "Payload: \n" +
            JSON.stringify(event, undefined, 4)
        );
      }

      return eventDate;
    }
  } catch (err) {
    logger.error("sourcesManager.getEventDate:\n", err);
    return undefined;
  }
};
