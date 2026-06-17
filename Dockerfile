# Dockerfile
FROM node:23-alpine

LABEL name="twivesdk_backend"

# Set the working directory
RUN mkdir -p /home/node/build/node_modules && chown -R node:node /home/node/build
WORKDIR /home/node/build

# Copy necessary files
COPY --chown=node:node package.json ./
COPY --chown=node:node tsconfig.json ./
COPY --chown=node:node .env ./

# Install dependencies
USER node
RUN npm install

# Copy the source code
COPY --chown=node:node src ./src

# Build the application
RUN npm run build

# Startup command
CMD [ "npm", "run", "start" ]
