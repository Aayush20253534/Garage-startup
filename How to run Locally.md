# Rovauto — Local Development and Docker Run Guide

> Guide synchronized with the repository on 8 August 2026.

This guide explains how to start the Rovauto project with Docker Desktop on Windows.

## Requirements

Current frontend dependencies include Redux Toolkit/React Redux and TanStack Query. Always run `npm ci` after pulling a change that modifies `client/package-lock.json`.

The current Prisma history has **57 migrations**; the latest is `20260807174500_add_full_rc_owner_name`. Use `npm run prisma:deploy` in deployment-like environments and `npm run prisma:migrate` only for local migration authoring.

Before running the project, make sure the following are installed:

- Docker Desktop for Windows
- Windows Subsystem for Linux 2 (WSL 2), when required by Docker Desktop
- The Rovauto codebase containing `docker-compose.yml`

The project directory used in the examples is:

```powershell
C:\Users\LENOVO\Desktop\Rovauto\Codebase
```

---

# First Time Setup

Follow these steps after installing Docker Desktop or when running the project for the first time.

## 1. Start Docker Desktop

Open Docker Desktop from the Windows Start menu.

Alternatively, run this command in PowerShell:

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
```

Wait until Docker Desktop finishes starting and the Docker engine is running.

## 2. Open PowerShell in the project directory

```powershell
cd "C:\Users\LENOVO\Desktop\Rovauto\Codebase"
```

Confirm that the Compose file exists:

```powershell
Get-ChildItem docker-compose.yml
```

## 3. Make the Docker command available

First, test whether Docker is already available:

```powershell
docker version
docker compose version
```

If PowerShell says that `docker` is not recognised, add Docker to the current PowerShell session:

```powershell
$dockerBin = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
$env:Path = "$dockerBin;$env:Path"
```

Test again:

```powershell
docker version
docker compose version
```

### Make the Docker PATH change permanent

Run this once so that future PowerShell windows can find Docker automatically:

```powershell
$dockerBin = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")

if (($userPath -split ";") -notcontains $dockerBin) {
    $newPath = if ([string]::IsNullOrWhiteSpace($userPath)) {
        $dockerBin
    } else {
        "$($userPath.TrimEnd(';'));$dockerBin"
    }

    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
}
```

After running it, close and reopen PowerShell or restart the VS Code terminal.

## 4. Build and start the project

Run:

```powershell
docker compose up --build
```

On the first run, Docker will:

- Download the required base images
- Build the frontend image
- Build the backend image
- Create the PostgreSQL/PostGIS container
- Create the Redis container
- Create and start the project containers

The first build can take several minutes.

When the containers start successfully, the terminal may continue displaying application logs. This is normal.

## 5. Check that the containers are running

Open another PowerShell window in the same project directory and run:

```powershell
docker compose ps
```

The required services should show a state such as `Up`, `Running`, or `Healthy`.

You can also check the containers from Docker Desktop under **Containers**.

## 6. Find the application URL

Run:

```powershell
docker compose ps
```

Check the `PORTS` column for the published frontend port. Open the displayed localhost address in your browser.

Docker Desktop may also show a clickable port beside the frontend container.

## 7. Run the project in the background

After confirming that the first build works, stop the attached logs with:

```text
Ctrl+C
```

Then start the services in the background:

```powershell
docker compose up -d
```

Check their status:

```powershell
docker compose ps
```

---

## Optional Way2API RC verification locally

Vehicle RC verification is server-side. To exercise it locally, set these in `server/.env`:

```env
VEHICLE_REGISTRATION_VERIFICATION_ENABLED=true
WAY2API_API_KEY=<your-key>
WAY2API_RC_URL=https://app.way2api.com/api/v1/rc/verify
WAY2API_RC_TIMEOUT_MS=12000
```

If you do not have a real provider key, do not invent one and do not expose a placeholder in the client. Provider-dependent RC verification will not work until the server has a valid key. Production startup requires the feature enabled and a real `WAY2API_API_KEY`; this local note is not a production bypass. Existing pre-migration customers remain optional; new accounts are registration-required by the backend.

The first-booking lead flow uses `FIRST_BOOKING_FREE_MAX_ESTIMATE`, `FIRST_BOOKING_LEAD_ESCALATION_MINUTES`, `FIRST_BOOKING_LEAD_WORKER_INTERVAL_MS`, and `FIRST_BOOKING_VERIFICATION_ADMIN_EMAIL` when that feature is exercised.

# Second Time / After Setup

Use these steps after the initial setup and successful build.

## 1. Start Docker Desktop

Open Docker Desktop and wait until the Docker engine is running.

Alternatively:

```powershell
Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
```

## 2. Open PowerShell in the project directory

```powershell
cd "C:\Users\LENOVO\Desktop\Rovauto\Codebase"
```

## 3. Start the existing containers

Start the project in the background:

```powershell
docker compose up -d
```

Check the status:

```powershell
docker compose ps
```

## 4. Open the application

Use the frontend port shown by:

```powershell
docker compose ps
```

Open the corresponding localhost address in your browser.

## 5. View application logs

View logs from all services:

```powershell
docker compose logs -f
```

View logs from one service:

```powershell
docker compose logs -f frontend
```

or:

```powershell
docker compose logs -f backend
```

Press `Ctrl+C` to stop following the logs. This does not stop containers running in the background.

---

# After Changing the Code

When source code or dependencies change, rebuild and restart the containers:

```powershell
docker compose up -d --build
```

Check the result:

```powershell
docker compose ps
```

View recent logs:

```powershell
docker compose logs --tail 100
```

---

## Manual web-client validation after state-management changes

```powershell
cd client
npm ci
npm run build
```

Verify navigation with browser HTTP cache disabled as well as enabled. TanStack Query caching should continue to work because it is held by the running React application, not by the HTTP cache. Also test logout/login between two users to confirm query data is cleared.

# Stop the Project

Stop and remove the project containers and network:

```powershell
docker compose down
```

This normally keeps named database volumes and their data.

To stop the containers without removing them:

```powershell
docker compose stop
```

To start stopped containers again:

```powershell
docker compose start
```

---

# Useful Commands

Check running services:

```powershell
docker compose ps
```

Restart all project services:

```powershell
docker compose restart
```

View logs:

```powershell
docker compose logs -f
```

Rebuild and start:

```powershell
docker compose up -d --build
```

Stop and remove containers:

```powershell
docker compose down
```

List all Docker containers:

```powershell
docker ps -a
```

List Docker images:

```powershell
docker images
```

---

# Troubleshooting

## `docker` is not recognised

Run:

```powershell
$dockerBin = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
$env:Path = "$dockerBin;$env:Path"
```

Then test:

```powershell
docker version
```

## Docker client works, but the server does not respond

Make sure Docker Desktop is open and wait until the Docker engine has finished starting.

Then run:

```powershell
docker version
```

The output should contain both a `Client` section and a `Server` section.

## A container exits or becomes unhealthy

Check its status:

```powershell
docker compose ps
```

Read the logs:

```powershell
docker compose logs --tail 200
```

For a specific service:

```powershell
docker compose logs --tail 200 backend
```

## Start again from a clean container state

```powershell
docker compose down
docker compose up -d --build
```

Do not add `--volumes` unless you intentionally want to remove stored database data.

## Confirm the Compose configuration

```powershell
docker compose config
```

This validates and displays the final Compose configuration.
