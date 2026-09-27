# Expense Sarathi - Deployment Architecture

The app runs in two places, and both use the **same container image** built from the root `Dockerfile`:

- **Local**: Docker Compose on a developer machine, SQLite in `db/`, FastAPI serves the API and the built frontend on `http://localhost:8080`.
- **AWS**: CloudFront in front of S3 (frontend) and API Gateway -> Lambda (API), RDS PostgreSQL, secrets in Secrets Manager, releases through GitHub Actions.

## Which document to read

| Task | Read |
|---|---|
| Running the app on your machine, `Dockerfile`, `docker-compose.yml`, `.env`, start/stop scripts | [references/local_deployment.md](references/local_deployment.md) |
| Hot-reload development, running tests locally, the PostgreSQL release check | [references/local_deployment.md](references/local_deployment.md) |
| Local problems (ports, cookies, line endings, PowerShell policy) | [references/local_deployment.md](references/local_deployment.md), section 10 |
| Creating or changing AWS infrastructure (VPC, RDS, Lambda, API Gateway, S3, CloudFront, IAM) | [references/aws_deployment.md](references/aws_deployment.md), sections 1-6 |
| Choosing how to create AWS resources: Console, CLI or Terraform | [references/aws_deployment.md](references/aws_deployment.md), sections 4, 5 and 6 |
| GitHub Actions release pipeline, OIDC, migrations during a release | [references/aws_deployment.md](references/aws_deployment.md), section 7 |
| Verifying, rolling back, operating or tearing down production | [references/aws_deployment.md](references/aws_deployment.md), sections 8-11 |
| Changing the image itself (affects both) | Both documents: the `Dockerfile` is described in local_deployment.md, section 3; its AWS-specific parts (Lambda Web Adapter, `--provenance=false`) in aws_deployment.md |

Related: [references/configuration.md](references/configuration.md) (settings per environment), [references/database.md](references/database.md) (migrations).
