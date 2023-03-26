FROM governify/base-node-14:1.0

COPY . .
RUN npm install --only=prod

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

# New Relic config
RUN apk add python
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
ENV NEW_RELIC_LOG=stdout

ARG PORT=80
ENV PORT $PORT
EXPOSE $PORT

CMD [ "node", "index.js" ]