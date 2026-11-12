FROM nginx:1.27-alpine

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built static client artifacts
COPY dist/client/ /usr/share/nginx/html/

# Symlink Meridian to current directory for /Meridian base path support
RUN ln -s /usr/share/nginx/html /usr/share/nginx/html/Meridian

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 8080
EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
