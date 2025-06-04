# Visa Developer Platform (VDP) Playground

A user-friendly interface for testing and developing with the Visa Developer Platform APIs.

## Prerequisites

- Node.js 18 or later
- npm 8 or later
- Docker and Docker Compose (for containerized deployment)

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vdp_playground
   ```

2. Install dependencies:
   ```bash
   npm install
   cd server && npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. In a separate terminal, start the backend server:
   ```bash
   cd server && node server.js
   ```

The application will be available at http://localhost:3000

## Docker Deployment

### Prerequisites
- Docker installed on your system
- Docker Compose installed on your system

### Setup Steps

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vdp_playground
   ```

2. Create required directories and files:
   ```bash
   mkdir -p certificates
   touch server/settings.json
   ```

3. Build and start the Docker container:
   ```bash
   docker-compose up --build
   ```

   This will:
   - Build the Docker image using the Dockerfile
   - Create a container from the image
   - Start the application
   - Mount the certificates and settings.json volumes
   - Expose port 3001

4. Access the application:
   - Open your browser and navigate to http://localhost:3001

### Docker Commands

- Start the application:
  ```bash
  docker-compose up
  ```

- Start in detached mode (background):
  ```bash
  docker-compose up -d
  ```

- Stop the application:
  ```bash
  docker-compose down
  ```

- View logs:
  ```bash
  docker-compose logs -f
  ```

- Rebuild and start:
  ```bash
  docker-compose up --build
  ```

### Volume Mounts

The Docker setup includes two volume mounts:
- `./certificates:/app/server/certificates`: For storing SSL certificates
- `./settings.json:/app/server/settings.json`: For storing application settings

### Environment Variables

The following environment variables are set in the Docker configuration:
- `NODE_ENV=production`
- `PORT=3001`
- `REACT_APP_API_URL=http://localhost:3001`

### Health Check

The container includes a health check that runs every 30 seconds to ensure the application is running properly.

## Configuration

1. SSL Certificates:
   - Place your SSL certificates in the `certificates` directory
   - The certificates will be automatically mounted into the container

2. Settings:
   - Configure your settings in `settings.json`
   - The file will be automatically mounted into the container

## Troubleshooting

1. If the application fails to start:
   ```bash
   docker-compose logs
   ```
   Check the logs for any error messages.

2. If you need to rebuild the container:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

3. If you need to clear Docker cache:
   ```bash
   docker system prune -a
   ```

## Security Notes

- The application runs in production mode in Docker
- SSL certificates and settings are mounted as volumes for persistence
- The container runs with minimal privileges
- Health checks are enabled to monitor application status

## Support

For any issues or questions, please open an issue in the repository.

## License

[Your License Information] 