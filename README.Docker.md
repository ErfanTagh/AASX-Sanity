# AAS Sanity - Docker Setup

This project has been dockerized for easy deployment and development.

## Quick Start

1. **Build and run all services:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Frontend: http://localhost
   - Backend API: http://localhost:5000

## Services

### Backend (Flask API)
- **Port:** 5000
- **Container:** aas-backend
- **Base Image:** Python 3.11-slim
- **Features:** Hot reloading enabled for development

### Frontend (Nginx)
- **Port:** 80
- **Container:** aas-frontend
- **Base Image:** nginx:alpine
- **Features:** Static file serving with API proxy

## Development Commands

```bash
# Build and start services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild specific service
docker-compose build backend
docker-compose build frontend

# Access backend container
docker-compose exec backend bash

# Access frontend container
docker-compose exec frontend sh
```

## Production Deployment

For production, consider:
1. Using environment-specific docker-compose files
2. Adding SSL/TLS certificates
3. Using secrets management
4. Setting up health checks
5. Using a reverse proxy like Traefik

## Troubleshooting

- **Port conflicts:** Change ports in docker-compose.yml if 80 or 5000 are in use
- **Permission issues:** Ensure Docker has proper permissions
- **Build failures:** Check Dockerfile syntax and dependencies
- **API connection issues:** Verify backend service is running and accessible

## File Structure

```
├── Backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── ... (Python files)
├── Dockerfile.frontend
├── docker-compose.yml
├── nginx.conf
├── .dockerignore
└── README.Docker.md
```
