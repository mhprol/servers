# AI-MANUAL for servers repository

This manual provides progressive disclosure for infrastructure operators managing the Model Context Protocol (MCP) servers.

## Level 1: Quick Reference (500 tokens)

### Service Mapping

| Server / Service | Command (Docker / NPX) | Intent |
| :--- | :--- | :--- |
| **memory** | `npx -y @modelcontextprotocol/server-memory` | Persistent knowledge graph |
| **filesystem** | `npx -y @modelcontextprotocol/server-filesystem /path` | File read/write access |
| **postgres** | `docker run -i --rm mcp/postgres postgresql://...` | PostgreSQL database inspection |
| **sqlite** | `npx -y @modelcontextprotocol/server-sqlite` | SQLite database analysis |
| **git** | `uvx mcp-server-git --repository /path/to/repo` | Git repository management |
| **github** | `docker run -e GITHUB_PERSONAL_ACCESS_TOKEN ...` | GitHub API integration |
| **slack** | `npx -y @modelcontextprotocol/server-slack` | Slack workspace interaction |
| **sentry** | `uvx mcp-server-sentry --auth-token ...` | Sentry issue analysis |
| **fetch** | `npx -y @modelcontextprotocol/server-fetch` | Web content retrieval |
| **puppeteer** | `docker run -i --rm mcp/puppeteer` | Browser automation |

### Core Operations

#### List Running Services
Most MCP servers run as short-lived processes or are managed by an MCP Client (like Claude Desktop).
To list Docker containers:
```bash
docker ps
```
To list Node processes:
```bash
ps aux | grep "mcp-server"
```

#### Deploy / Redeploy a Service
**Using Docker:**
```bash
# Build
docker build -t mcp/<service-name> -f src/<service-name>/Dockerfile .

# Run (Stdio mode)
docker run -i --rm mcp/<service-name> [ARGS]
```

**Using NPX:**
```bash
npx -y @modelcontextprotocol/server-<service-name> [ARGS]
```

#### Check Service Status / Logs
**Docker:**
```bash
docker logs <container-id>
```
**Stdio:**
Logs are often printed to `stderr` while `stdout` is used for protocol communication. Redirect stderr to a file to view logs without corrupting the protocol stream.
```bash
npx -y @modelcontextprotocol/server-memory 2> server.log
tail -f server.log
```

#### Configure Environment
Pass environment variables using `-e` in Docker or `export` in shell.
```bash
# Docker
docker run -i --rm -e MY_VAR=value mcp/service

# NPX
MY_VAR=value npx -y @modelcontextprotocol/server-service
```

#### Scale Services
Since most MCP servers are stateless or manage their own state (like `memory` with a JSON file), scaling usually means running multiple distinct instances for different contexts or users.
To run multiple instances, simply invoke the command multiple times with different configurations (e.g., different `--repository` paths for `git`).

---

## Level 2: Operational Detail (2000 tokens)

### Service Catalog

#### Data Retrieval & Analysis
*   **aws-kb-retrieval-server**: Retrieves context from AWS Knowledge Base using Bedrock Agent Runtime.
*   **brave-search**: Performs web and local searches using Brave Search API.
*   **fetch**: Fetches web content and converts HTML to Markdown.
*   **google-maps**: Provides location services, directions, and place details.
*   **sentry**: Retrieves and analyzes issues from Sentry.io.
*   **time**: Provides current time and timezone conversion.
*   **weather**: (If available) Fetches weather data.
*   **wikipedia**: (If available) Searches Wikipedia.

#### Integration & Communication
*   **github**: Manages files, issues, PRs, and searches on GitHub.
*   **gitlab**: Project management and file operations on GitLab.
*   **slack**: Channel management and messaging on Slack.
*   **gdrive**: Lists, reads, and searches files on Google Drive.

#### Database & Storage
*   **filesystem**: Secure file operations (read/write/list) on local disk.
*   **memory**: Knowledge graph-based persistent memory system (JSON backed).
*   **postgres**: Read-only database access with schema inspection for PostgreSQL.
*   **sqlite**: Database interaction and business intelligence for SQLite.
*   **redis**: Key-value store interaction.

#### Development & Automation
*   **git**: Local Git repository interaction (diff, commit, log).
*   **puppeteer**: Browser automation and scraping (headless Chrome).
*   **sequentialthinking**: Dynamic problem-solving tool.
*   **everything**: Reference server implementing many MCP features for testing.

### Deployment Procedures

#### General Docker Deployment
1.  **Build the image:**
    From the root of the repository:
    ```bash
    docker build -t mcp/<service-name> -f src/<service-name>/Dockerfile .
    ```
2.  **Run the container:**
    Most servers communicate via Stdio. You must run them interactively (`-i`) but usually without a TTY (`-t`) if piping to a client.
    ```bash
    docker run -i --rm mcp/<service-name> [ARGS]
    ```

#### Example: PostgreSQL
1.  **Build:** `docker build -t mcp/postgres -f src/postgres/Dockerfile .`
2.  **Run:**
    ```bash
    docker run -i --rm mcp/postgres postgresql://user:password@host.docker.internal:5432/mydb
    ```
    *Note: Use `host.docker.internal` to access a DB on the host machine.*

#### Example: Filesystem
1.  **Build:** `docker build -t mcp/filesystem -f src/filesystem/Dockerfile .`
2.  **Run:**
    ```bash
    docker run -i --rm \
      --mount type=bind,src=/Users/me/files,dst=/projects/files \
      mcp/filesystem /projects/files
    ```

### Configuration & Environment Variables

Most services are configured via command-line arguments (passed as `args` in MCP clients) or Environment Variables.

*   **Common Environment Variables:**
    *   `GITHUB_PERSONAL_ACCESS_TOKEN`: Required for `github` server.
    *   `SLACK_BOT_TOKEN`, `SLACK_TEAM_ID`: Required for `slack` server.
    *   `BRAVE_API_KEY`: Required for `brave-search`.
    *   `GOOGLE_MAPS_API_KEY`: Required for `google-maps`.

*   **Command Line Arguments:**
    *   `filesystem`: List of allowed directories.
    *   `git`: `--repository /path/to/repo`.
    *   `sentry`: `--auth-token <token>`.
    *   `postgres`: Database URL connection string.

### Logging and Monitoring

*   **Standard Logs:** MCP servers write logs to `stderr`.
*   **MCP Inspector:** Use the inspector to view protocol messages and logs interactively.
    ```bash
    npx @modelcontextprotocol/inspector npx -y @modelcontextprotocol/server-memory
    ```
*   **Docker Logs:**
    If running in detached mode (rare for Stdio servers) or orchestrating via a bridge:
    ```bash
    docker logs <container_id>
    ```

### Database and Cache Setup

*   **PostgreSQL (`postgres` server):**
    *   The MCP server is a *client*. You need an existing PostgreSQL instance.
    *   Ensure the MCP server (in Docker) can reach the Postgres host.
    *   The server is Read-Only by default for safety.

*   **SQLite (`sqlite` server):**
    *   Uses a local file.
    *   Mount the directory containing the `.db` file if using Docker.

*   **Redis (`redis` server):**
    *   Connects to an external Redis instance.
    *   Provide the Redis URL (e.g., `redis://localhost:6379`).

### Networking and Port Configuration

*   **Stdio Transport (Default):**
    *   Most servers in this repo use Stdio (Standard Input/Output) transport.
    *   **No ports are opened.** Communication happens via the process's stdin/stdout.
    *   This is secure and simple for local usage (e.g., Claude Desktop).

*   **SSE (Server-Sent Events) Transport:**
    *   Some servers (like `everything`) may support SSE.
    *   If running in SSE mode, the server *will* bind to a port (usually 8000 or specified via env var `PORT`).
    *   **Config:** `PORT=3000 node build/index.js`

---

## Level 3: Advanced Workflows (1500 tokens)

### Multi-service Deployment Workflows

Infrastructure operators often need to deploy multiple MCP servers to provide a suite of tools to an AI agent.

#### Claude Desktop Configuration
The standard way to orchestrate multiple servers is via the `claude_desktop_config.json` file.

**Example `claude_desktop_config.json`:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "filesystem": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--mount", "type=bind,src=/Users/username/work,dst=/projects/work",
        "mcp/filesystem",
        "/projects/work"
      ]
    },
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git", "--repository", "/Users/username/work/repo"]
    }
  }
}
```

### Integration Between Services

While MCP servers are typically isolated, they can be used together by the LLM to perform complex tasks.

*   **Workflow Example: Research & Save**
    1.  **Search:** Use `brave-search` to find information.
    2.  **Browse:** Use `fetch` or `puppeteer` to read content.
    3.  **Store:** Use `filesystem` to save a summary to a Markdown file.
    4.  **Commit:** Use `git` to commit the file to a repository.

*   **Workflow Example: Database Analysis**
    1.  **Inspect:** Use `postgres` to read schema and data.
    2.  **Analyze:** Use `sequentialthinking` to process the data insights.
    3.  **Report:** Use `slack` to send a summary to the team.

### Backup and Recovery Procedures

*   **Memory Server (`memory.json`):**
    *   **Backup:** The knowledge graph is stored in `memory.json` (or configured path). Regularly back up this file.
    *   **Recovery:** Restore the file to the path and restart the server.

*   **SQLite:**
    *   **Backup:** Standard SQLite backup procedures (copy the `.db` file).

*   **Stateless Servers (e.g., `fetch`, `google-maps`):**
    *   No backup needed. Just ensure API keys are secure and available.

### Scaling Strategies

*   **Horizontal Scaling (Client-Side):**
    *   Run multiple instances of the same server with different configurations (e.g., one `git` server for Repo A, another for Repo B).
    *   Register them as `git-repo-a` and `git-repo-b` in the client config.

*   **Remote Deployment (SSE):**
    *   Deploy MCP servers as web services (using SSE transport) behind a load balancer.
    *   Use an MCP Gateway or Proxy (like `mcp-proxy`) to aggregate them.
    *   This allows centralized management of API keys and access control.

### Troubleshooting Common Issues

#### 1. "Command not found" / "Spawn failed"
*   **Cause:** `npx`, `docker`, or `uvx` is not in the system PATH seen by the MCP Client (e.g., Claude Desktop).
*   **Fix:** Use absolute paths to executables (e.g., `/usr/local/bin/docker`) in the config JSON.

#### 2. "Connection Refused" (Docker)
*   **Cause:** Container cannot reach `localhost` services (like Postgres or Redis).
*   **Fix:** Use `host.docker.internal` instead of `localhost` inside the container connection string.

#### 3. "Authentication Failed"
*   **Cause:** Missing or invalid API keys/tokens.
*   **Fix:** Check `env` block in config. Ensure tokens have correct scopes (e.g., GitHub token needs `repo` scope).

#### 4. Protocol Errors / JSON Parsing Errors
*   **Cause:** Server printing logs to `stdout` instead of `stderr`.
*   **Fix:** Ensure the server implementation uses `console.error` for logs. Redirect stdout if testing manually.

### Integration with Monitoring/Alerting

*   **Sentry Integration:** Use the `sentry` MCP server to allow the LLM to *read* Sentry issues.
*   **Server Health Monitoring:**
    *   Since most are stdio, "health" is binary (process running or not).
    *   For SSE deployments, standard HTTP health checks (`/health` endpoint if implemented) apply.
    *   Wrap `npx`/`docker` commands in a wrapper script to log exit codes and restart on failure if running as a persistent daemon.
