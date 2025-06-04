# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd server && npm install

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Move build directory to server directory
RUN mv build server/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV REACT_APP_API_URL=http://localhost:3001

# Create directories for certificates and settings
RUN mkdir -p /app/server/certificates

# Expose ports
EXPOSE 3001

# Start the application
CMD ["node", "server/server.js"] 