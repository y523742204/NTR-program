# ntr container deployment

The deployment keeps the server's existing Node.js, MySQL, Redis, PHP, Nginx, and legacy
applications unchanged.

## Isolation

| Resource         | Production               | Test                      |
| ---------------- | ------------------------ | ------------------------- |
| Domain           | `server.mojiekj.com`     | `test-server.mojiekj.com` |
| Host port        | `127.0.0.1:13000`        | `127.0.0.1:13100`         |
| Database         | `ntr_prod`               | `ntr_test`                |
| Runtime role     | `ntr_prod_app`           | `ntr_test_app`            |
| Migration role   | `ntr_prod_migrator`      | `ntr_test_migrator`       |
| Upload directory | `/data/ntr/prod/uploads` | `/data/ntr/test/uploads`  |

Both APIs use one resource-limited PostgreSQL container, but separate databases and least-privilege
roles. PostgreSQL is only reachable inside `ntr-net`; it has no host port.

The shared server still runs Docker 20.10.1, whose default seccomp profile prevents the current
Node.js 22 image from creating worker threads. ntr API and migration containers therefore use
`seccomp=unconfined` while retaining non-root runtime execution, dropped capabilities, a read-only
runtime filesystem, and `no-new-privileges`. Remove the compatibility override after Docker is
upgraded.

## Files kept outside Git

Create these root-owned files on the server with mode `0600`:

- `/etc/ntr/postgres.env`
- `/etc/ntr/prod.env`
- `/etc/ntr/test.env`
- `/etc/ntr/prod-migrate.env`
- `/etc/ntr/test-migrate.env`

The Compose interpolation file `/opt/ntr/images.env` contains image tags only.

## Release order

1. Build `runtime` and `migration` images for `linux/amd64` away from the server.
2. Transfer and load the images without deleting existing server images.
3. Start PostgreSQL.
4. Run the test migration and start the test API.
5. Verify test health and behavior.
6. Run the production migration and start the production API.
7. Validate Nginx configuration before a graceful reload.

Never run `docker system prune`, `docker volume prune`, or an unscoped `docker compose down` on the
shared server.

## Automated releases

After configuring the deployment SSH key, publish a committed backend release to test with:

```bash
pnpm deploy:api:test
```

The command validates the API, builds Linux/AMD64 runtime and migration images, transfers them over
SSH, applies test migrations, replaces only the test API container, and verifies its health. Before
uploading the release archive and again after a successful deployment, it removes only old
`ntr-api` and `ntr-migrate` images. The current production image, current test image, and five
most recent releases are always retained. The release stops before upload when less than 5 GiB is
available after cleanup.

Production accepts only the exact `origin/master` commit. Switch to an up-to-date local `master`,
deploy it to test, complete acceptance testing, and then promote that tested image:

```bash
git switch master
git pull --ff-only origin master
pnpm deploy:api:test
pnpm deploy:api:prod
```

Production promotion requires typing the tested release tag, creates and validates a PostgreSQL
backup, applies production migrations, replaces only the production API container, and verifies its
health. It refuses to run outside `master`, when local `master` differs from `origin/master`, or when
the tested server image has another commit tag. The server keeps the active images, five recent
releases, and database backups for manual recovery. Cleanup never prunes images belonging to other
applications on the shared server.
