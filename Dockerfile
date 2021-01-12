FROM node:14.3-alpine3.11

# Create app directory
WORKDIR /opt/app

# Install app dependencies
COPY package*.json ./

RUN npm install

COPY . .

# default to port 80 for node
ARG PORT=80
ENV PORT $PORT
EXPOSE $PORT


CMD [ "node", "index.js" ]