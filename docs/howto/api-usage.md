# API Usage & Authentication Guide

This guide explains how to authenticate and interact with the EuroTourno API.

## Authentication

The API uses **JSON Web Tokens (JWT)** for authentication.
All protected endpoints require a valid JWT in the `Authorization` header.

### Header Format

```http
Authorization: Bearer <your_token_here>
```

## User Management

### 1. Create a User (Registration)

To create a new user account, send a POST request to `/api/users`.

**Endpoint:** `POST /api/users`  
**Auth:** Public (No token required)

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "role": "player"
}
```

_Note: `role` is optional and defaults to "player"._

### 2. Login

To authenticate and receive a token, use the login endpoint.

**Endpoint:** `POST /api/auth/login`  
**Auth:** Public

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**

```json
{
  "message": "Login successful",
  "user": {
    "username": "user@example.com",
    "role": "player",
    "email": "user@example.com",
    "id": 123
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR..."
}
```

### 3. Using the Token

Include the received `token` in the Authorization header for subsequent requests.

**Example: Get Current User**
`GET /api/auth/me`

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR...
```

## Role Management

User roles (e.g., `organizer`, `admin`) are managed via the `/api/roles` endpoints.

### Add a Role to a User

**Endpoint:** `POST /api/roles`  
**Auth:** Required (Admin or authorized user)

**Request Body:**

```json
{
  "userId": 123,
  "roleName": "organizer",
  "tournamentId": 456
}
```

_`tournamentId` is optional and used for tournament-specific roles._

## Error Handling

- **401 Unauthorized:** Missing or invalid token.
- **403 Forbidden:** Valid token but insufficient permissions.
- **400 Bad Request:** Invalid input (e.g., missing fields).
