FROM node:18-alpine

WORKDIR /home/node/app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy only package files first for better caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Build the app
RUN pnpm build

# Expose the port
EXPOSE 3000

# Start the app
CMD ["pnpm", "start"]