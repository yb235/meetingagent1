# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server.js ./

# Expose port
EXPOSE 8080

# Set environment variable defaults
ENV PORT=8080
ENV NODE_ENV=production

# Run the application
CMD ["node", "server.js"]
