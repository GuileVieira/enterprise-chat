# LibreChat Project Overview

This document provides a comprehensive overview of the LibreChat project, its architecture, and development conventions.

## Project Overview

LibreChat is a free and open-source AI chat platform that provides a user-friendly interface for interacting with various AI models. It is inspired by ChatGPT but offers enhanced features, including:

*   **Multiple AI Model Support:** LibreChat supports a wide range of AI models, including those from OpenAI, Anthropic, Google, and custom endpoints.
*   **Code Interpreter:** A secure, sandboxed environment for executing code in multiple languages.
*   **Agents & Tools Integration:** Allows for the creation and use of custom AI agents and tools.
*   **Web Search:** The ability to search the web and incorporate the results into the AI's responses.
*   **Image Generation:** Text-to-image and image-to-image generation capabilities.
*   **Multimodal Chat:** The ability to interact with the AI using both text and images.
*   **Multi-User and Secure:** Supports multiple users with secure authentication and access control.

The project is a monorepo with the following structure:

*   `api/`: The backend API, built with Node.js and Express.
*   `client/`: The frontend application, built with React.
*   `packages/`: Shared packages used by both the `api` and `client`.

## Building and Running

The following are the key commands for building, running, and testing the project:

*   **Start the backend (production):** `npm run backend`
*   **Start the backend (development):** `npm run backend:dev`
*   **Build the frontend:** `npm run frontend`
*   **Start the frontend (development):** `npm run frontend:dev`
*   **Run end-to-end tests:** `npm run e2e`

### Docker

The project includes a `docker-compose.yml` file for running the application in a containerized environment. The following services are defined:

*   `api`: The main application.
*   `mongodb`: The primary database.
*   `meilisearch`: The search engine.
*   `vectordb`: A PostgreSQL database with the pgvector extension for RAG.
*   `rag_api`: A separate API for the RAG functionality.

To start the application with Docker, use the following command:

```bash
docker-compose up -d
```

## Development Conventions

*   **Linting:** The project uses ESLint for code linting. To run the linter, use `npm run lint`. To fix linting errors, use `npm run lint:fix`.
*   **Formatting:** The project uses Prettier for code formatting. To format the code, use `npm run format`.
*   **Testing:** The project uses Jest for unit and integration testing. To run the tests, you can use `npm run test:client` for the client-side tests and `npm run test:api` for the api-side tests.
*   **Pre-commit Hooks:** The project uses `husky` and `lint-staged` to run linting and formatting checks before each commit.
*   **Continuous Integration:** The project uses GitHub Actions for continuous integration and deployment.

## Configuration

The application is configured using the `librechat.yaml` file. A detailed example is provided in `librechat.example.yaml`. The configuration allows for customization of:

*   **AI Endpoints:** Configure access to various AI models.
*   **File Storage:** Choose between local, S3, or Firebase storage.
*   **Authentication:** Enable social logins and other authentication methods.
*   **UI:** Customize the look and feel of the application.
*   **Features:** Enable or disable various features.
