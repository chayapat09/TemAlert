# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package.json and package-lock.json (if available)
COPY frontend/package*.json ./

# Install frontend dependencies
RUN npm install

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the frontend
RUN npm run build

# Stage 2: Build Backend and Serve Frontend
FROM node:18-alpine

WORKDIR /app

# Set NODE_ENV to production - good practice
ENV NODE_ENV=production

# Copy backend package.json and package-lock.json (if available)
COPY package*.json ./

# Install backend dependencies (only production dependencies)
# The 'npm ci' command is often preferred in CI/CD for faster, more reliable builds
# It requires a package-lock.json or npm-shrinkwrap.json
# RUN npm ci --omit=dev
# For general use or if you don't have a lock file consistently:
RUN npm install --omit=dev

# Copy the rest of the backend source code (excluding node_modules)
COPY . .

# Copy the built frontend from the previous stage
# The path /app/frontend/dist in the builder stage will be copied to /app/frontend/dist in this stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the port the backend server runs on
EXPOSE 5001

# Command to run the backend application
# The backend's package.json start script is 'node server.js'
CMD [ "npm", "start" ]