# Server Deployment

This server is set up to deploy on Render with SQLite and uploaded files stored on a persistent disk.

## Render setup

1. Create a new **Web Service** from this repository.
2. Set the service root directory to `server`.
3. Use these build and start commands:
   - Build: `npm install`
   - Start: `npm start`
4. Add a persistent disk mounted at `/var/data`.
5. Set these environment variables:
   - `CLIENT_URL` = your Vercel client URL
   - `DB_PATH` = `/var/data/PadiBridge.db`
   - `UPLOADS_DIR` = `/var/data/uploads`

## Client configuration

After the server is live, set the client environment variable in Vercel:

- `REACT_APP_API_BASE_URL` = your Render server URL

## Notes

- The health check endpoint is `/api/health`.
- Keep the disk mounted path and the `DB_PATH` / `UPLOADS_DIR` values aligned.
- If you choose a host without persistent disk support, migrate the database to Postgres instead of SQLite.