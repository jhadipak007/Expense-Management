# Expense Sarathi - AWS Deployment

How to create the AWS infrastructure (Console, CLI or Terraform), release with GitHub Actions, verify, roll back and operate the production app.

Related: [local_deployment.md](local_deployment.md) (local runs and the PostgreSQL release check), [configuration.md](configuration.md) (settings), [database.md](database.md) (migrations).

## 1. Architecture

```
                       https://<cloudfront-domain or custom domain>
                                        │
                                  ┌─────▼─────┐
                                  │ CloudFront │  security headers, HTTPS, SPA rewrite
                                  └──┬──────┬──┘
                    default (*)      │      │   /api/*
                  ┌──────────────────┘      └──────────────────┐
             ┌────▼────┐                              ┌────────▼────────┐
             │   S3    │  private, Origin Access      │ API Gateway     │  HTTP API, throttling
             │ (Vite   │  Control only                │ (HTTP API)      │
             │  build) │                              └────────┬────────┘
             └─────────┘                                       │ Lambda alias "live"
                                              ┌────────────────▼───────────────────┐
                                              │ VPC  (2 AZs)                       │
                                              │  private subnets:                  │
                                              │   Lambda (container image from ECR)│──► Secrets Manager
                                              │   RDS PostgreSQL                   │    (VPC endpoint)
                                              │  public subnets:                   │
                                              │   ECS Fargate task (migrations)    │
                                              └────────────────────────────────────┘

GitHub Actions ──OIDC──> AWS: push image to ECR, run migrations, update Lambda, upload frontend, invalidate CloudFront
```

Key decisions:
- **Single origin.** CloudFront serves the frontend and forwards `/api/*` to API Gateway, so there is no CORS and the refresh cookie is first-party.
- **SPA deep links** are handled by a CloudFront Function on the default (S3) behavior that rewrites paths without a file extension to `/index.html`. Distribution-wide custom error pages are **not** used, because they would also replace real API 404 responses with `index.html`.
- **Lambda in private subnets** reaches RDS directly and Secrets Manager through a VPC interface endpoint. No NAT gateway is needed.
- **Secrets** are read at cold start by pydantic-settings' `AWSSecretsManagerSettingsSource` from one JSON secret. They are never stored in Lambda environment variables or GitHub.
- **Migrations** run as a one-off ECS Fargate task using the same image, in a public subnet with a public IP (outbound only, no inbound rules), before Lambda traffic moves to the new version.
- **Releases** go through a Lambda alias `live`; rollback is pointing the alias back to the previous version.

## 2. Resources and naming

Region: choose one close to users, for example `ap-south-1` (Mumbai). Written below as `<region>`. The ACM certificate for a custom domain must be in `us-east-1` (CloudFront requirement).

| # | Resource | Name | Key settings |
|---|---|---|---|
| 1 | VPC | `expense-sarathi-vpc` | `10.0.0.0/16`, DNS hostnames on |
| 2 | Subnets | `...-public-a/b`, `...-private-a/b` | public `10.0.0.0/24`, `10.0.1.0/24`; private `10.0.10.0/24`, `10.0.11.0/24`; two AZs |
| 3 | Internet gateway + public route table | `expense-sarathi-igw` | `0.0.0.0/0` -> IGW for public subnets only |
| 4 | Security groups | `...-lambda-sg`, `...-migrate-sg`, `...-rds-sg`, `...-vpce-sg` | RDS: 5432 from lambda and migrate SGs; endpoint: 443 from lambda SG |
| 5 | VPC endpoint | Secrets Manager (interface) | private subnets, private DNS on |
| 6 | Secret | `expense-sarathi/prod/app` | JSON: `db_user`, `db_password`, `jwt_secret` |
| 7 | RDS | `expense-sarathi-db` | PostgreSQL (latest major RDS offers), `db.t4g.micro`, 20 GB gp3, encrypted, private, 7-day backups, deletion protection |
| 8 | ECR repository | `expense-sarathi` | immutable tags, scan on push, keep last 20 images |
| 9 | IAM roles | `...-lambda-role`, `...-ecs-exec-role`, `...-migrate-task-role`, `...-github-deploy` | least privilege (policies in section 5, Option B) |
| 10 | Lambda | `expense-sarathi-api` + alias `live` | image, 1024 MB, 29 s timeout, VPC private subnets |
| 11 | API Gateway | `expense-sarathi-api` (HTTP API) | route `ANY /api/{proxy+}` -> alias `live`; throttling |
| 12 | S3 bucket | `expense-sarathi-web-<account-id>` | private, block public access, versioning, SSE-S3 |
| 13 | CloudFront | distribution + OAC + function + response headers policy | two origins, two behaviors |
| 14 | ECS | cluster `expense-sarathi`, task definition `expense-sarathi-migrate` | Fargate, 0.25 vCPU / 0.5 GB |
| 15 | CloudWatch | log groups (30-day retention), alarms, SNS topic `expense-sarathi-alerts` | email subscription |
| 16 | GitHub OIDC provider | `token.actions.githubusercontent.com` | trusted by `...-github-deploy` role |

Lambda environment variables (non-secret):

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `USE_POSTGRESQL_DB` | `true` |
| `DB_HOST` | RDS endpoint address |
| `DB_PORT` | `5432` |
| `DB_NAME` | `expense_sarathi` |
| `AWS_SECRETS_MANAGER_SECRET_ID` | `expense-sarathi/prod/app` |
| `COOKIE_SECURE` | `true` |
| `ENABLE_API_DOCS` | `false` |
| `ALLOWED_HOSTS` | `["<api-id>.execute-api.<region>.amazonaws.com"]` (CloudFront sends the API Gateway host, not the viewer host) |
| `LOG_LEVEL` | `INFO` |
| `AWS_LWA_PORT` | `8080` |
| `AWS_LWA_READINESS_CHECK_PATH` | `/api/health` |

The migration task uses the same variables except the `AWS_LWA_*` ones.

## 3. Before you start (all three options)

1. **AWS account**: use an IAM Identity Center (SSO) user or IAM user with admin rights for the one-time setup. Do not use the root user; enable MFA on root.
2. **Billing alarm**: Billing and Cost Management -> Budgets -> create a monthly cost budget with an email alert.
3. **Tools on your machine**: AWS CLI v2 (`aws --version`), Docker with `buildx`, Node.js 24, `uv`, and for option C Terraform (latest 1.x).
4. **Log in**: `aws configure sso` (or `aws configure`), then `aws sts get-caller-identity` shows the right account.
5. **Generate secrets locally** (do not commit them):
   ```bash
   openssl rand -hex 32                                    # jwt_secret
   openssl rand -base64 32 | tr -d '/+=@"' | cut -c1-32    # db_password (RDS forbids / @ " and spaces)
   ```
6. **App code prerequisites** (must be merged before the first deploy):
   - `/api/health` endpoint.
   - `Settings` adds `AWSSecretsManagerSettingsSource` when `AWS_SECRETS_MANAGER_SECRET_ID` is set (via a small bootstrap `BaseSettings`, so no `os.environ` access). Dependency: `uv add "pydantic-settings[aws-secrets-manager]"`.
   - PostgreSQL driver: `uv add "psycopg[binary]"`; URL uses `postgresql+psycopg` with `sslmode=require`.
   - SQLAlchemy engine for Lambda: `pool_size=2`, `max_overflow=0`, `pool_pre_ping=True`, `pool_recycle=300`.

Order of creation is the same for every option: **network -> security groups -> VPC endpoint -> secret -> RDS -> ECR + first image -> IAM -> Lambda -> API Gateway -> S3 -> CloudFront -> ECS migration task -> first migration -> first frontend upload -> monitoring -> GitHub OIDC + workflows -> verify**.

---

## 4. Option A: AWS Console (click by click)

Set the region selector (top right) to `<region>` for every step except ACM for a custom domain.

### A1. VPC and subnets
1. **VPC** -> **Create VPC** -> choose **VPC and more**.
2. Name tag auto-generation: `expense-sarathi`. IPv4 CIDR: `10.0.0.0/16`.
3. Number of AZs: **2**. Public subnets: **2**. Private subnets: **2**.
4. NAT gateways: **None**. VPC endpoints: **None** (the Secrets Manager endpoint is added in A3).
5. DNS options: tick **Enable DNS hostnames** and **Enable DNS resolution**.
6. **Create VPC**. Note the VPC ID and the four subnet IDs.

### A2. Security groups
In **VPC -> Security groups -> Create security group**, create four groups in the new VPC. Leave the default outbound rule (all traffic) on each.
1. `expense-sarathi-lambda-sg`: no inbound rules.
2. `expense-sarathi-migrate-sg`: no inbound rules.
3. `expense-sarathi-rds-sg`: inbound **PostgreSQL (5432)** from source `expense-sarathi-lambda-sg`, and another rule for 5432 from `expense-sarathi-migrate-sg`.
4. `expense-sarathi-vpce-sg`: inbound **HTTPS (443)** from `expense-sarathi-lambda-sg`.

### A3. Secrets Manager VPC endpoint
1. **VPC -> Endpoints -> Create endpoint**. Name `expense-sarathi-secretsmanager`.
2. Type **AWS services**; search `secretsmanager`; select `com.amazonaws.<region>.secretsmanager`.
3. VPC: `expense-sarathi-vpc`. Subnets: the two **private** subnets.
4. Security group: `expense-sarathi-vpce-sg`. **Enable private DNS name**: on.
5. **Create endpoint**.

### A4. Application secret
1. **Secrets Manager -> Store a new secret** -> **Other type of secret**.
2. Key/value pairs: `db_user` = `expense_admin`, `db_password` = generated password, `jwt_secret` = generated hex string.
3. Encryption key: `aws/secretsmanager`. Name: `expense-sarathi/prod/app`. No automatic rotation.
4. **Store**. Copy the secret ARN.

### A5. RDS PostgreSQL
1. **RDS -> Subnet groups -> Create DB subnet group**: name `expense-sarathi-db`, VPC `expense-sarathi-vpc`, add the two **private** subnets.
2. **RDS -> Databases -> Create database** -> **Standard create** -> **PostgreSQL**, latest major version offered.
3. Templates: **Free tier** or **Production** (Production adds Multi-AZ; choose it if you need high availability and accept the cost).
4. DB instance identifier `expense-sarathi-db`. Master username `expense_admin`. Credentials management: **Self managed**, paste the same password as in the secret.
5. Instance class `db.t4g.micro`. Storage gp3, 20 GiB, storage autoscaling max 100 GiB.
6. Connectivity: VPC `expense-sarathi-vpc`, subnet group `expense-sarathi-db`, **Public access: No**, security group: remove `default`, choose `expense-sarathi-rds-sg`.
7. Additional configuration: Initial database name `expense_sarathi`. Backup retention **7 days**. **Encryption** on. **Enable deletion protection**. Enable auto minor version upgrade.
8. **Create database**, wait until status is **Available**, copy the **Endpoint**.

### A6. ECR repository and first image
1. **ECR -> Create repository**: name `expense-sarathi`, tag immutability **Immutable**, scan on push **on**.
2. Open the repository -> **Lifecycle policy** -> rule: *Image count more than 20* -> *expire*.
3. Click **View push commands** and run them from your machine, with two changes to the build command:
   ```bash
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
   docker buildx build --platform linux/amd64 --provenance=false \
     -t <account-id>.dkr.ecr.<region>.amazonaws.com/expense-sarathi:$(git rev-parse --short HEAD) --push .
   ```
   `--provenance=false` is required: Lambda rejects multi-manifest images that buildx creates by default.

### A7. IAM roles
1. **IAM -> Roles -> Create role** -> trusted entity **AWS service** -> **Lambda**.
   - Attach `AWSLambdaVPCAccessExecutionRole`. Name `expense-sarathi-lambda-role`.
   - After creation: **Add permissions -> Create inline policy** (JSON) allowing `secretsmanager:GetSecretValue` on the secret ARN (policy in step B7).
2. **Create role** -> **Elastic Container Service** -> **Elastic Container Service Task**.
   - Attach `AmazonECSTaskExecutionRolePolicy`. Name `expense-sarathi-ecs-exec-role`.
3. **Create role** -> **Elastic Container Service Task** again, no managed policies. Name `expense-sarathi-migrate-task-role`. Add the same inline `GetSecretValue` policy.

### A8. Lambda function
1. **Lambda -> Create function** -> **Container image**.
2. Name `expense-sarathi-api`. Image URI: **Browse images** -> the image pushed in A6. Architecture **x86_64**.
3. Execution role: **Use an existing role** -> `expense-sarathi-lambda-role`.
4. Advanced settings -> **Enable VPC**: VPC `expense-sarathi-vpc`, the two **private** subnets, security group `expense-sarathi-lambda-sg`.
5. **Create function**.
6. **Configuration -> General configuration -> Edit**: memory **1024 MB**, timeout **29 s**.
7. **Configuration -> Environment variables -> Edit**: add every variable from the table in section 2. Put a placeholder for `ALLOWED_HOSTS` for now; it is set in A9.
8. **Configuration -> Concurrency -> Edit**: reserved concurrency **20** (caps database connections). New accounts with a total limit of 10 cannot reserve concurrency; skip this step until the limit is raised through Service Quotas.
9. **Test** tab: not needed; the health check happens through API Gateway.
10. **Actions -> Publish new version**, then **Aliases -> Create alias**: name `live`, version = the one just published.

### A9. API Gateway (HTTP API)
1. **API Gateway -> Create API -> HTTP API -> Build**.
2. Integration: **Lambda**, function `expense-sarathi-api:live` (the alias ARN), version **2.0**. API name `expense-sarathi-api`.
3. Routes: method **ANY**, path `/api/{proxy+}`, target the integration. Add two more routes with the same target: `POST /api/auth/login` and `POST /api/auth/register`.
4. Stage: `$default`, auto-deploy **on**. **Create**.
5. Integration -> **Manage integration** -> timeout **29000 ms**.
6. **Protect -> Throttling**: default route throttling burst **100**, rate **50**. Route throttling for `POST /api/auth/login` and `POST /api/auth/register`: burst **10**, rate **5**.
7. Confirm the permission: open the Lambda alias `live` -> **Configuration -> Permissions** shows an API Gateway resource-based policy. If it is missing, add one (principal `apigateway.amazonaws.com`, source ARN of this API).
8. Copy the **Invoke URL** host (`<api-id>.execute-api.<region>.amazonaws.com`).
9. Back in Lambda: set `ALLOWED_HOSTS` to `["<api-id>.execute-api.<region>.amazonaws.com"]`, publish a new version, and point alias `live` to it.

### A10. S3 bucket for the frontend
1. **S3 -> Create bucket**: name `expense-sarathi-web-<account-id>`, region `<region>`.
2. Object ownership **ACLs disabled**. **Block all public access**: on. **Bucket versioning**: enable. Default encryption **SSE-S3**.
3. **Create bucket**. The bucket policy is added after CloudFront exists (A11 step 9).

### A11. CloudFront
1. **CloudFront -> Functions -> Create function**: name `expense-sarathi-spa-rewrite`, runtime **cloudfront-js-2.0**, code:
   ```js
   function handler(event) {
     var request = event.request;
     if (!request.uri.includes('.')) {
       request.uri = '/index.html';
     }
     return request;
   }
   ```
   **Save**, then **Publish** tab -> **Publish function**.
2. **Policies -> Response headers -> Create response headers policy** `expense-sarathi-security-headers`:
   - Strict-Transport-Security: max-age `63072000`, include subdomains, override.
   - X-Content-Type-Options: on. X-Frame-Options: `DENY`. Referrer-Policy: `no-referrer`.
   - Content-Security-Policy: `default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`.
3. **Distributions -> Create distribution**.
4. Origin 1: choose the S3 bucket. Origin access: **Origin access control settings** -> **Create new OAC** (sign requests). Name the origin `web`.
5. Default cache behavior: viewer protocol **Redirect HTTP to HTTPS**, allowed methods **GET, HEAD**, cache policy **CachingOptimized**, response headers policy `expense-sarathi-security-headers`, function association **Viewer request** -> CloudFront Function `expense-sarathi-spa-rewrite`.
6. Settings: default root object `index.html`, HTTP/2 and HTTP/3 on, price class as needed. WAF: optional (costs extra). **Create distribution**.
7. **Origins -> Create origin**: origin domain = the API Gateway host from A9, protocol **HTTPS only**, minimum TLSv1.2. Name `api`.
8. **Behaviors -> Create behavior**: path pattern `/api/*`, origin `api`, viewer protocol **HTTPS only**, allowed methods **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**, cache policy **CachingDisabled**, origin request policy **AllViewerExceptHostHeader** (API Gateway rejects a forwarded viewer Host header). No function association.
9. Copy the bucket policy CloudFront shows in the S3 origin banner (**Copy policy**) and paste it into **S3 -> bucket -> Permissions -> Bucket policy**.
10. Wait until the distribution status is **Deployed**. Note the distribution ID and domain (`dxxxx.cloudfront.net`).

### A12. ECS cluster and migration task
1. **CloudWatch -> Log groups -> Create**: `/ecs/expense-sarathi-migrate`, retention 30 days.
2. **ECS -> Clusters -> Create cluster**: name `expense-sarathi`, infrastructure **AWS Fargate** only.
3. **ECS -> Task definitions -> Create new task definition**: family `expense-sarathi-migrate`, launch type **Fargate**, OS **Linux/X86_64**, CPU **0.25 vCPU**, memory **0.5 GB**, task role `expense-sarathi-migrate-task-role`, task execution role `expense-sarathi-ecs-exec-role`.
4. Container: name `migrate`, image URI from A6, essential **yes**, no port mappings, **Command override** `alembic,upgrade,head`, environment variables = the Lambda table without `AWS_LWA_*`, log collection **awslogs** to `/ecs/expense-sarathi-migrate`.
5. **Create**.

### A13. First migration
1. **ECS -> Clusters -> expense-sarathi -> Tasks -> Run new task**.
2. Launch type **Fargate**, task definition `expense-sarathi-migrate` (latest revision).
3. Networking: VPC `expense-sarathi-vpc`, a **public** subnet, security group `expense-sarathi-migrate-sg`, **Public IP: turned on**.
4. **Create**. Wait for status **Stopped**, then check **Exit code 0** on the container and read the logs (tables created, categories seeded).

### A14. First frontend upload
1. On your machine: `cd frontend && npm ci && npm run build`.
2. Upload with the correct cache headers (the console cannot set per-folder headers easily, so use the CLI):
   ```bash
   aws s3 sync dist/assets s3://expense-sarathi-web-<account-id>/assets --delete \
     --cache-control "public,max-age=31536000,immutable"
   aws s3 sync dist s3://expense-sarathi-web-<account-id> --delete --exclude "assets/*" \
     --cache-control "no-cache"
   ```
3. **CloudFront -> distribution -> Invalidations -> Create**: paths `/index.html` and `/`.

### A15. Monitoring
1. **CloudWatch -> Log groups**: set retention **30 days** on `/aws/lambda/expense-sarathi-api`.
2. **SNS -> Topics -> Create** `expense-sarathi-alerts` (standard) -> **Create subscription** (email) -> confirm the email.
3. **CloudWatch -> Alarms -> Create alarm**, each notifying the SNS topic:
   - Lambda `Errors` (function `expense-sarathi-api`) Sum >= 5 in 5 minutes.
   - Lambda `Throttles` Sum >= 1 in 5 minutes.
   - API Gateway `5xx` (API `expense-sarathi-api`) Sum >= 5 in 5 minutes.
   - RDS `CPUUtilization` Average >= 80% for 15 minutes.
   - RDS `FreeStorageSpace` <= 2 GB.
   - RDS `DatabaseConnections` >= 60 (t4g.micro allows about 80).
4. Optional: API Gateway stage **Monitor -> Logging** -> enable access logs to a new log group.

### A16. GitHub OIDC and deploy role
1. **IAM -> Identity providers -> Add provider** -> **OpenID Connect**: provider URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
2. **IAM -> Roles -> Create role** -> **Web identity** -> that provider, audience `sts.amazonaws.com`, GitHub organization/user `<owner>`, repository `<repo>`, environment `production`. Name `expense-sarathi-github-deploy`.
3. Add the inline deploy policy from step B16.
4. Continue with [section 7, Release pipeline](#7-release-pipeline-github-actions).

### A17. Verify
Follow [section 8, Post-deployment verification](#8-post-deployment-verification).

### A18. Optional: custom domain
1. **ACM in us-east-1 -> Request certificate** for `app.<domain>`, DNS validation; add the CNAME in Route 53 (**Create records in Route 53**).
2. CloudFront distribution -> **Edit**: alternate domain name `app.<domain>`, custom SSL certificate = that certificate.
3. Route 53 hosted zone -> **Create record** `app` -> **Alias** -> CloudFront distribution (A and AAAA).
4. No Lambda change is needed: `ALLOWED_HOSTS` stays the API Gateway host.

---

## 5. Option B: AWS CLI

Run in bash (macOS, Linux, or Git Bash on Windows) from the project root. Each step stores IDs in shell variables used by later steps; keep the same terminal open, or save the values.

### B0. Variables
```bash
export AWS_REGION=ap-south-1
export APP=expense-sarathi
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
export BUCKET=$APP-web-$ACCOUNT_ID
mkdir -p infra-cli && cd infra-cli        # JSON files below are saved here (git-ignored)
```

### B1. VPC, subnets, internet gateway, routes
```bash
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=$APP-vpc}]" \
  --query Vpc.VpcId --output text)
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames Value=true

mk_subnet() {  # name cidr az
  aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block $2 --availability-zone $3 \
    --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=$APP-$1}]" \
    --query Subnet.SubnetId --output text
}
PUB_A=$(mk_subnet public-a 10.0.0.0/24 ${AWS_REGION}a)
PUB_B=$(mk_subnet public-b 10.0.1.0/24 ${AWS_REGION}b)
PRIV_A=$(mk_subnet private-a 10.0.10.0/24 ${AWS_REGION}a)
PRIV_B=$(mk_subnet private-b 10.0.11.0/24 ${AWS_REGION}b)

IGW_ID=$(aws ec2 create-internet-gateway --query InternetGateway.InternetGatewayId --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID
PUB_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --query RouteTable.RouteTableId --output text)
aws ec2 create-route --route-table-id $PUB_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_A
aws ec2 associate-route-table --route-table-id $PUB_RT --subnet-id $PUB_B
```
Private subnets stay on the VPC's main route table (local traffic only).

### B2. Security groups
```bash
mk_sg() {
  aws ec2 create-security-group --group-name $APP-$1 --description "$APP $1" \
    --vpc-id $VPC_ID --query GroupId --output text
}
LAMBDA_SG=$(mk_sg lambda-sg); MIGRATE_SG=$(mk_sg migrate-sg)
RDS_SG=$(mk_sg rds-sg);       VPCE_SG=$(mk_sg vpce-sg)

aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $LAMBDA_SG
aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $MIGRATE_SG
aws ec2 authorize-security-group-ingress --group-id $VPCE_SG --protocol tcp --port 443 --source-group $LAMBDA_SG
```

### B3. Secrets Manager VPC endpoint
```bash
aws ec2 create-vpc-endpoint --vpc-id $VPC_ID --vpc-endpoint-type Interface \
  --service-name com.amazonaws.$AWS_REGION.secretsmanager \
  --subnet-ids $PRIV_A $PRIV_B --security-group-ids $VPCE_SG --private-dns-enabled
```

### B4. Application secret
```bash
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=@"' | cut -c1-32)
JWT_SECRET=$(openssl rand -hex 32)
SECRET_ARN=$(aws secretsmanager create-secret --name $APP/prod/app \
  --secret-string "{\"db_user\":\"expense_admin\",\"db_password\":\"$DB_PASSWORD\",\"jwt_secret\":\"$JWT_SECRET\"}" \
  --query ARN --output text)
```

### B5. RDS PostgreSQL
```bash
aws rds create-db-subnet-group --db-subnet-group-name $APP-db \
  --db-subnet-group-description "$APP private subnets" --subnet-ids $PRIV_A $PRIV_B

aws rds create-db-instance --db-instance-identifier $APP-db \
  --engine postgres --db-instance-class db.t4g.micro \
  --allocated-storage 20 --max-allocated-storage 100 --storage-type gp3 --storage-encrypted \
  --master-username expense_admin --master-user-password "$DB_PASSWORD" \
  --db-name expense_sarathi --db-subnet-group-name $APP-db --vpc-security-group-ids $RDS_SG \
  --no-publicly-accessible --backup-retention-period 7 --deletion-protection \
  --auto-minor-version-upgrade --copy-tags-to-snapshot
# Add --engine-version <x.y> to pin a version; without it RDS uses its current default.

aws rds wait db-instance-available --db-instance-identifier $APP-db
DB_HOST=$(aws rds describe-db-instances --db-instance-identifier $APP-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)
```

### B6. ECR repository and first image
```bash
aws ecr create-repository --repository-name $APP \
  --image-tag-mutability IMMUTABLE --image-scanning-configuration scanOnPush=true
aws ecr put-lifecycle-policy --repository-name $APP --lifecycle-policy-text \
  '{"rules":[{"rulePriority":1,"description":"keep last 20","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":20},"action":{"type":"expire"}}]}'

aws ecr get-login-password | docker login --username AWS --password-stdin $ECR
TAG=$(git rev-parse --short HEAD)
(cd .. && docker buildx build --platform linux/amd64 --provenance=false -t $ECR/$APP:$TAG --push .)
IMAGE=$ECR/$APP:$TAG
```

### B7. IAM roles
```bash
cat > lambda-trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
cat > ecs-trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
cat > read-secret.json <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"secretsmanager:GetSecretValue","Resource":"$SECRET_ARN"}]}
EOF

aws iam create-role --role-name $APP-lambda-role --assume-role-policy-document file://lambda-trust.json
aws iam attach-role-policy --role-name $APP-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole
aws iam put-role-policy --role-name $APP-lambda-role --policy-name read-app-secret --policy-document file://read-secret.json

aws iam create-role --role-name $APP-ecs-exec-role --assume-role-policy-document file://ecs-trust.json
aws iam attach-role-policy --role-name $APP-ecs-exec-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam create-role --role-name $APP-migrate-task-role --assume-role-policy-document file://ecs-trust.json
aws iam put-role-policy --role-name $APP-migrate-task-role --policy-name read-app-secret --policy-document file://read-secret.json
```
Wait about 10 seconds for IAM to propagate before B8.

### B8. Lambda function and alias
```bash
write_lambda_env() {  # $1 = allowed host
cat > lambda-env.json <<EOF
{"Variables":{
  "ENVIRONMENT":"production","USE_POSTGRESQL_DB":"true",
  "DB_HOST":"$DB_HOST","DB_PORT":"5432","DB_NAME":"expense_sarathi",
  "AWS_SECRETS_MANAGER_SECRET_ID":"$APP/prod/app",
  "COOKIE_SECURE":"true","ENABLE_API_DOCS":"false","LOG_LEVEL":"INFO",
  "ALLOWED_HOSTS":"[\"$1\"]",
  "AWS_LWA_PORT":"8080","AWS_LWA_READINESS_CHECK_PATH":"/api/health"}}
EOF
}
write_lambda_env placeholder

aws lambda create-function --function-name $APP-api --package-type Image \
  --code ImageUri=$IMAGE --role arn:aws:iam::$ACCOUNT_ID:role/$APP-lambda-role \
  --architectures x86_64 --memory-size 1024 --timeout 29 \
  --vpc-config SubnetIds=$PRIV_A,$PRIV_B,SecurityGroupIds=$LAMBDA_SG \
  --environment file://lambda-env.json
aws lambda wait function-active-v2 --function-name $APP-api

# Skip if the account concurrency limit is 10 (new accounts).
aws lambda put-function-concurrency --function-name $APP-api --reserved-concurrent-executions 20

aws logs create-log-group --log-group-name /aws/lambda/$APP-api 2>/dev/null
aws logs put-retention-policy --log-group-name /aws/lambda/$APP-api --retention-in-days 30
```
The alias is created in B9 after `ALLOWED_HOSTS` is known.

### B9. API Gateway HTTP API
```bash
API_ID=$(aws apigatewayv2 create-api --name $APP-api --protocol-type HTTP --query ApiId --output text)
API_HOST=$API_ID.execute-api.$AWS_REGION.amazonaws.com

# Now set ALLOWED_HOSTS, publish a version and create the alias.
write_lambda_env $API_HOST
aws lambda update-function-configuration --function-name $APP-api --environment file://lambda-env.json
aws lambda wait function-updated-v2 --function-name $APP-api
VERSION=$(aws lambda publish-version --function-name $APP-api --query Version --output text)
aws lambda create-alias --function-name $APP-api --name live --function-version $VERSION
ALIAS_ARN=arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$APP-api:live

INTEG_ID=$(aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY \
  --integration-uri $ALIAS_ARN --payload-format-version 2.0 --timeout-in-millis 29000 \
  --query IntegrationId --output text)
for ROUTE in 'ANY /api/{proxy+}' 'POST /api/auth/login' 'POST /api/auth/register'; do
  aws apigatewayv2 create-route --api-id $API_ID --route-key "$ROUTE" --target integrations/$INTEG_ID
done
aws apigatewayv2 create-stage --api-id $API_ID --stage-name '$default' --auto-deploy \
  --default-route-settings ThrottlingBurstLimit=100,ThrottlingRateLimit=50 \
  --route-settings '{"POST /api/auth/login":{"ThrottlingBurstLimit":10,"ThrottlingRateLimit":5},"POST /api/auth/register":{"ThrottlingBurstLimit":10,"ThrottlingRateLimit":5}}'

aws lambda add-permission --function-name $APP-api --qualifier live \
  --statement-id apigateway-invoke --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$AWS_REGION:$ACCOUNT_ID:$API_ID/*"

curl -s https://$API_HOST/api/health     # expect {"status":"ok"}
```

### B10. S3 bucket
```bash
aws s3api create-bucket --bucket $BUCKET --create-bucket-configuration LocationConstraint=$AWS_REGION
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket $BUCKET --versioning-configuration Status=Enabled
```
(In `us-east-1`, omit `--create-bucket-configuration`.)

### B11. CloudFront
```bash
# 1. Origin Access Control
OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config \
  Name=$APP-oac,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3 \
  --query OriginAccessControl.Id --output text)

# 2. SPA rewrite function
cat > spa-rewrite.js <<'EOF'
function handler(event) {
  var request = event.request;
  if (!request.uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
EOF
aws cloudfront create-function --name $APP-spa-rewrite \
  --function-config Comment="SPA rewrite",Runtime=cloudfront-js-2.0 --function-code fileb://spa-rewrite.js
ETAG=$(aws cloudfront describe-function --name $APP-spa-rewrite --query ETag --output text)
aws cloudfront publish-function --name $APP-spa-rewrite --if-match $ETAG
FUNC_ARN=$(aws cloudfront describe-function --name $APP-spa-rewrite --stage LIVE \
  --query FunctionSummary.FunctionMetadata.FunctionARN --output text)

# 3. Security headers policy
cat > headers-policy.json <<'EOF'
{"Name":"expense-sarathi-security-headers","SecurityHeadersConfig":{
  "StrictTransportSecurity":{"Override":true,"AccessControlMaxAgeSec":63072000,"IncludeSubdomains":true},
  "ContentTypeOptions":{"Override":true},
  "FrameOptions":{"Override":true,"FrameOption":"DENY"},
  "ReferrerPolicy":{"Override":true,"ReferrerPolicy":"no-referrer"},
  "ContentSecurityPolicy":{"Override":true,"ContentSecurityPolicy":"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}}}
EOF
RHP_ID=$(aws cloudfront create-response-headers-policy --response-headers-policy-config file://headers-policy.json \
  --query ResponseHeadersPolicy.Id --output text)

# 4. Distribution (managed policy IDs: CachingOptimized, CachingDisabled, AllViewerExceptHostHeader)
cat > distribution.json <<EOF
{
  "CallerReference": "$APP-$(date +%s)",
  "Comment": "Expense Sarathi",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "HttpVersion": "http2and3",
  "PriceClass": "PriceClass_All",
  "Origins": {"Quantity": 2, "Items": [
    {"Id": "web", "DomainName": "$BUCKET.s3.$AWS_REGION.amazonaws.com",
     "OriginAccessControlId": "$OAC_ID", "S3OriginConfig": {"OriginAccessIdentity": ""}},
    {"Id": "api", "DomainName": "$API_HOST",
     "CustomOriginConfig": {"HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "https-only",
       "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]}}}
  ]},
  "DefaultCacheBehavior": {
    "TargetOriginId": "web", "ViewerProtocolPolicy": "redirect-to-https", "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "ResponseHeadersPolicyId": "$RHP_ID",
    "FunctionAssociations": {"Quantity": 1, "Items": [{"EventType": "viewer-request", "FunctionARN": "$FUNC_ARN"}]}
  },
  "CacheBehaviors": {"Quantity": 1, "Items": [{
    "PathPattern": "/api/*", "TargetOriginId": "api", "ViewerProtocolPolicy": "https-only", "Compress": true,
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac",
    "AllowedMethods": {"Quantity": 7, "Items": ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET","HEAD"]}}
  }]}
}
EOF
DIST_ID=$(aws cloudfront create-distribution --distribution-config file://distribution.json \
  --query Distribution.Id --output text)
DIST_DOMAIN=$(aws cloudfront get-distribution --id $DIST_ID --query Distribution.DomainName --output text)

# 5. Bucket policy: only this distribution may read
cat > bucket-policy.json <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
  "Principal":{"Service":"cloudfront.amazonaws.com"},"Action":"s3:GetObject",
  "Resource":"arn:aws:s3:::$BUCKET/*",
  "Condition":{"StringEquals":{"AWS:SourceArn":"arn:aws:cloudfront::$ACCOUNT_ID:distribution/$DIST_ID"}}}]}
EOF
aws s3api put-bucket-policy --bucket $BUCKET --policy file://bucket-policy.json

aws cloudfront wait distribution-deployed --id $DIST_ID
```

### B12. ECS cluster and migration task definition
```bash
aws ecs create-cluster --cluster-name $APP
aws logs create-log-group --log-group-name /ecs/$APP-migrate
aws logs put-retention-policy --log-group-name /ecs/$APP-migrate --retention-in-days 30

cat > migrate-task.json <<EOF
{
  "family": "$APP-migrate",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256", "memory": "512",
  "runtimePlatform": {"operatingSystemFamily": "LINUX", "cpuArchitecture": "X86_64"},
  "executionRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/$APP-ecs-exec-role",
  "taskRoleArn": "arn:aws:iam::$ACCOUNT_ID:role/$APP-migrate-task-role",
  "containerDefinitions": [{
    "name": "migrate", "image": "$IMAGE", "essential": true,
    "command": ["alembic", "upgrade", "head"],
    "environment": [
      {"name": "ENVIRONMENT", "value": "production"},
      {"name": "USE_POSTGRESQL_DB", "value": "true"},
      {"name": "DB_HOST", "value": "$DB_HOST"},
      {"name": "DB_PORT", "value": "5432"},
      {"name": "DB_NAME", "value": "expense_sarathi"},
      {"name": "AWS_SECRETS_MANAGER_SECRET_ID", "value": "$APP/prod/app"}
    ],
    "logConfiguration": {"logDriver": "awslogs", "options": {
      "awslogs-group": "/ecs/$APP-migrate", "awslogs-region": "$AWS_REGION", "awslogs-stream-prefix": "migrate"}}
  }]
}
EOF
aws ecs register-task-definition --cli-input-json file://migrate-task.json
```

### B13. First migration
```bash
TASK_ARN=$(aws ecs run-task --cluster $APP --launch-type FARGATE --task-definition $APP-migrate \
  --network-configuration "awsvpcConfiguration={subnets=[$PUB_A],securityGroups=[$MIGRATE_SG],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' --output text)
aws ecs wait tasks-stopped --cluster $APP --tasks $TASK_ARN
aws ecs describe-tasks --cluster $APP --tasks $TASK_ARN --query 'tasks[0].containers[0].exitCode'   # must be 0
aws logs tail /ecs/$APP-migrate --since 15m
```

### B14. First frontend upload
```bash
(cd ../frontend && npm ci && npm run build)
aws s3 sync ../frontend/dist/assets s3://$BUCKET/assets --delete --cache-control "public,max-age=31536000,immutable"
aws s3 sync ../frontend/dist s3://$BUCKET --delete --exclude "assets/*" --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/index.html" "/"
echo "App: https://$DIST_DOMAIN"
```

### B15. Monitoring
```bash
TOPIC_ARN=$(aws sns create-topic --name $APP-alerts --query TopicArn --output text)
aws sns subscribe --topic-arn $TOPIC_ARN --protocol email --notification-endpoint <your-email>   # confirm the email

alarm() {  # name namespace metric dimension stat threshold operator periods
  aws cloudwatch put-metric-alarm --alarm-name $APP-$1 --namespace $2 --metric-name $3 \
    --dimensions $4 --statistic $5 --period 300 --evaluation-periods $8 \
    --threshold $6 --comparison-operator $7 --treat-missing-data notBreaching --alarm-actions $TOPIC_ARN
}
alarm lambda-errors    AWS/Lambda     Errors              Name=FunctionName,Value=$APP-api         Sum     5          GreaterThanOrEqualToThreshold 1
alarm lambda-throttles AWS/Lambda     Throttles           Name=FunctionName,Value=$APP-api         Sum     1          GreaterThanOrEqualToThreshold 1
alarm api-5xx          AWS/ApiGateway 5xx                 Name=ApiId,Value=$API_ID                 Sum     5          GreaterThanOrEqualToThreshold 1
alarm rds-cpu          AWS/RDS        CPUUtilization      Name=DBInstanceIdentifier,Value=$APP-db  Average 80         GreaterThanOrEqualToThreshold 3
alarm rds-storage      AWS/RDS        FreeStorageSpace    Name=DBInstanceIdentifier,Value=$APP-db  Minimum 2000000000 LessThanOrEqualToThreshold    1
alarm rds-connections  AWS/RDS        DatabaseConnections Name=DBInstanceIdentifier,Value=$APP-db  Maximum 60         GreaterThanOrEqualToThreshold 1
```

### B16. GitHub OIDC provider and deploy role
```bash
aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com

cat > github-trust.json <<EOF
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
  "Principal":{"Federated":"arn:aws:iam::$ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"},
  "Action":"sts:AssumeRoleWithWebIdentity",
  "Condition":{
    "StringEquals":{"token.actions.githubusercontent.com:aud":"sts.amazonaws.com",
                    "token.actions.githubusercontent.com:sub":"repo:<owner>/<repo>:environment:production"}}}]}
EOF

cat > github-deploy-policy.json <<EOF
{"Version":"2012-10-17","Statement":[
  {"Effect":"Allow","Action":"ecr:GetAuthorizationToken","Resource":"*"},
  {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:InitiateLayerUpload","ecr:UploadLayerPart",
     "ecr:CompleteLayerUpload","ecr:PutImage","ecr:BatchGetImage","ecr:DescribeImages"],
   "Resource":"arn:aws:ecr:$AWS_REGION:$ACCOUNT_ID:repository/$APP"},
  {"Effect":"Allow","Action":["lambda:UpdateFunctionCode","lambda:PublishVersion","lambda:UpdateAlias",
     "lambda:GetFunction","lambda:GetFunctionConfiguration","lambda:GetAlias"],
   "Resource":["arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$APP-api","arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:$APP-api:*"]},
  {"Effect":"Allow","Action":["ecs:RegisterTaskDefinition","ecs:DescribeTaskDefinition","ecs:RunTask","ecs:DescribeTasks"],"Resource":"*"},
  {"Effect":"Allow","Action":"iam:PassRole","Resource":["arn:aws:iam::$ACCOUNT_ID:role/$APP-ecs-exec-role","arn:aws:iam::$ACCOUNT_ID:role/$APP-migrate-task-role"]},
  {"Effect":"Allow","Action":["logs:GetLogEvents","logs:FilterLogEvents"],"Resource":"arn:aws:logs:$AWS_REGION:$ACCOUNT_ID:log-group:/ecs/$APP-migrate:*"},
  {"Effect":"Allow","Action":["s3:ListBucket"],"Resource":"arn:aws:s3:::$BUCKET"},
  {"Effect":"Allow","Action":["s3:PutObject","s3:DeleteObject","s3:GetObject"],"Resource":"arn:aws:s3:::$BUCKET/*"},
  {"Effect":"Allow","Action":"cloudfront:CreateInvalidation","Resource":"arn:aws:cloudfront::$ACCOUNT_ID:distribution/$DIST_ID"}
]}
EOF

aws iam create-role --role-name $APP-github-deploy --assume-role-policy-document file://github-trust.json
aws iam put-role-policy --role-name $APP-github-deploy --policy-name deploy --policy-document file://github-deploy-policy.json
```

### B17. Save outputs for GitHub
Print the values needed as GitHub repository variables (see section 7):
```bash
echo "AWS_REGION=$AWS_REGION"
echo "AWS_ROLE_ARN=arn:aws:iam::$ACCOUNT_ID:role/$APP-github-deploy"
echo "ECR_REPOSITORY=$APP"
echo "LAMBDA_FUNCTION=$APP-api"
echo "ECS_CLUSTER=$APP"
echo "MIGRATE_TASK_FAMILY=$APP-migrate"
echo "MIGRATE_SUBNET=$PUB_A"
echo "MIGRATE_SG=$MIGRATE_SG"
echo "WEB_BUCKET=$BUCKET"
echo "CLOUDFRONT_DISTRIBUTION_ID=$DIST_ID"
echo "APP_URL=https://$DIST_DOMAIN"
```
The JSON files in `infra-cli/` contain no secrets, but keep the folder git-ignored or delete it. Close the terminal afterwards so the `DB_PASSWORD` and `JWT_SECRET` shell variables are gone; never write them to a file.

---

## 6. Option C: Terraform

### C1. Layout
```
infra/
├── bootstrap/                 # one-time: state bucket (applied with local state)
│   └── main.tf
├── versions.tf                # required providers, S3 backend
├── providers.tf               # aws (region) + aws.us_east_1 (ACM for custom domain)
├── variables.tf               # region, app name, github repo, alert email, image_tag
├── network.tf                 # VPC module, subnets, IGW, routes, VPC endpoint
├── security_groups.tf
├── secrets.tf                 # random_password + secret
├── rds.tf
├── ecr.tf
├── iam.tf                     # lambda, ecs exec, migrate task roles
├── lambda.tf                  # function + alias
├── api_gateway.tf
├── s3.tf
├── cloudfront.tf              # OAC, function, headers policy, distribution, bucket policy
├── ecs_migrate.tf             # cluster, log group, task definition
├── monitoring.tf              # log retention, SNS, alarms
├── github_oidc.tf             # OIDC provider + deploy role
├── outputs.tf                 # values for GitHub variables
└── functions/spa-rewrite.js
```

### C2. Bootstrap the state bucket (once)
1. `infra/bootstrap/main.tf` creates an S3 bucket `expense-sarathi-tfstate-<account-id>` with versioning, SSE, and all public access blocked.
2. Run:
   ```bash
   cd infra/bootstrap && terraform init && terraform apply
   ```
3. `infra/versions.tf` uses that bucket with S3 native locking (Terraform 1.10+):
   ```hcl
   terraform {
     required_version = ">= 1.10"
     required_providers {
       aws    = { source = "hashicorp/aws", version = "~> 6.0" }
       random = { source = "hashicorp/random", version = "~> 3.6" }
     }
     backend "s3" {
       bucket       = "expense-sarathi-tfstate-<account-id>"
       key          = "prod/terraform.tfstate"
       region       = "ap-south-1"
       encrypt      = true
       use_lockfile = true
     }
   }
   ```
   The state contains the generated DB password and JWT secret, so only admins may read this bucket.

### C3. Key resources (excerpts)
Network, using the community VPC module:
```hcl
module "vpc" {
  source               = "terraform-aws-modules/vpc/aws"
  version              = "~> 6.0"
  name                 = var.app
  cidr                 = "10.0.0.0/16"
  azs                  = ["${var.region}a", "${var.region}b"]
  public_subnets       = ["10.0.0.0/24", "10.0.1.0/24"]
  private_subnets      = ["10.0.10.0/24", "10.0.11.0/24"]
  enable_nat_gateway   = false
  enable_dns_hostnames = true
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = module.vpc.vpc_id
  service_name        = "com.amazonaws.${var.region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = module.vpc.private_subnets
  security_group_ids  = [aws_security_group.vpce.id]
  private_dns_enabled = true
}
```

Secret and database:
```hcl
resource "random_password" "db" {
  length           = 32
  override_special = "!#$%^&*()-_=+[]{}<>:?"   # excludes / @ " and space (RDS rules)
}
resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "app" { name = "${var.app}/prod/app" }
resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    db_user     = "expense_admin"
    db_password = random_password.db.result
    jwt_secret  = random_password.jwt.result
  })
}

resource "aws_db_instance" "main" {
  identifier                = "${var.app}-db"
  engine                    = "postgres"
  instance_class            = "db.t4g.micro"
  allocated_storage         = 20
  max_allocated_storage     = 100
  storage_type              = "gp3"
  storage_encrypted         = true
  db_name                   = "expense_sarathi"
  username                  = "expense_admin"
  password                  = random_password.db.result
  db_subnet_group_name      = aws_db_subnet_group.main.name
  vpc_security_group_ids    = [aws_security_group.rds.id]
  publicly_accessible       = false
  backup_retention_period   = 7
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.app}-db-final"
  copy_tags_to_snapshot     = true
}
```

Lambda: the image changes on every release through GitHub Actions, so Terraform ignores those fields after creation:
```hcl
resource "aws_lambda_function" "api" {
  function_name = "${var.app}-api"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"
  role          = aws_iam_role.lambda.arn
  architectures = ["x86_64"]
  memory_size   = 1024
  timeout       = 29
  publish       = true
  reserved_concurrent_executions = 20

  vpc_config {
    subnet_ids         = module.vpc.private_subnets
    security_group_ids = [aws_security_group.lambda.id]
  }
  environment { variables = local.app_env }   # table in section 2, ALLOWED_HOSTS from the API Gateway resource

  lifecycle { ignore_changes = [image_uri] }
}

resource "aws_lambda_alias" "live" {
  name             = "live"
  function_name    = aws_lambda_function.api.function_name
  function_version = aws_lambda_function.api.version
  lifecycle { ignore_changes = [function_version] }
}
```
`ALLOWED_HOSTS` is built from the API host, `trimprefix(aws_apigatewayv2_api.api.api_endpoint, "https://")`. Terraform orders creation through this reference (API -> Lambda -> alias -> integration), so there is no cycle.

CloudFront `/api/*` behavior, inside `aws_cloudfront_distribution` (the important parts):
```hcl
data "aws_cloudfront_cache_policy" "disabled"   { name = "Managed-CachingDisabled" }
data "aws_cloudfront_cache_policy" "optimized"  { name = "Managed-CachingOptimized" }
data "aws_cloudfront_origin_request_policy" "all_except_host" { name = "Managed-AllViewerExceptHostHeader" }

ordered_cache_behavior {
  path_pattern             = "/api/*"
  target_origin_id         = "api"
  viewer_protocol_policy   = "https-only"
  allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
  cached_methods           = ["GET", "HEAD"]
  cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
  origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_except_host.id
  compress                 = true
}
```
All other resources map one-to-one to the Console and CLI steps (same names and settings as the table in section 2).

### C4. Apply
1. `cd infra && terraform init`
2. Create the ECR repository first, because Lambda needs an image to exist:
   ```bash
   terraform apply -target=aws_ecr_repository.app
   ```
3. Build and push the first image (same commands as B6); note the tag.
4. Apply everything:
   ```bash
   terraform plan -var="image_tag=<tag>" -var="alert_email=<email>" -var="github_repo=<owner>/<repo>" -out=tfplan
   terraform apply tfplan
   ```
5. Confirm the SNS subscription email.
6. Run the first migration (same commands as B13, using `terraform output` values), then upload the frontend (B14).
7. `terraform output` prints the GitHub variables listed in B17.
8. Commit `infra/` (never `*.tfstate`, `.terraform/`, `tfplan` or `*.tfvars` with secrets; add them to `.gitignore`). Commit `.terraform.lock.hcl`.

### C5. Changing infrastructure later
- Edit `.tf` files -> `terraform plan` -> review -> `terraform apply`.
- Infrastructure changes are applied by an admin, not by the release pipeline. The pipeline only ships code (image, migrations, frontend).
- Never change resources in the console that Terraform manages; the next apply would revert them.

---

## 7. Release pipeline (GitHub Actions)

Used after the infrastructure exists, whichever option created it.

### GitHub setup (once)
1. Repository **Settings -> Environments -> New environment** `production`. Optional: required reviewers (manual approval before deploy), deployment branch rule `main`.
2. **Settings -> Secrets and variables -> Actions -> Variables** (environment `production`): add the values printed in B17 (`AWS_REGION`, `AWS_ROLE_ARN`, `ECR_REPOSITORY`, `LAMBDA_FUNCTION`, `ECS_CLUSTER`, `MIGRATE_TASK_FAMILY`, `MIGRATE_SUBNET`, `MIGRATE_SG`, `WEB_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `APP_URL`). None of these are secrets; no AWS keys are stored in GitHub.
3. Branch protection on `main`: require the CI workflow to pass and require a PR review.

### Workflows
| File | Trigger | Jobs |
|---|---|---|
| `.github/workflows/ci.yml` | pull request to `main` | backend tests (SQLite), frontend tests, frontend build, Docker build (no push) |
| `.github/workflows/deploy.yml` | push to `main`, manual `workflow_dispatch` | test -> build and push image -> migrate -> update Lambda -> upload frontend -> smoke test |

### deploy.yml (outline)
```yaml
name: deploy
on:
  push: { branches: [main] }
  workflow_dispatch:

permissions:
  id-token: write        # OIDC
  contents: read

concurrency: { group: deploy-production, cancel-in-progress: false }

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: astral-sh/setup-uv@v6
      - run: cd backend && uv sync --locked && uv run pytest
      - uses: actions/setup-node@v5
        with: { node-version: 22, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: cd frontend && npm ci && npm test && npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment: production
    env:
      IMAGE_TAG: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v5
      - uses: aws-actions/configure-aws-credentials@v5
        with:
          role-to-assume: ${{ vars.AWS_ROLE_ARN }}
          aws-region: ${{ vars.AWS_REGION }}
      - id: ecr
        uses: aws-actions/amazon-ecr-login@v2
      - uses: docker/setup-buildx-action@v3

      - name: Build and push image
        run: |
          IMAGE=${{ steps.ecr.outputs.registry }}/${{ vars.ECR_REPOSITORY }}:$IMAGE_TAG
          docker buildx build --platform linux/amd64 --provenance=false -t $IMAGE --push .
          echo "IMAGE=$IMAGE" >> $GITHUB_ENV

      - name: Run migrations (ECS Fargate task with the new image)
        run: |
          aws ecs describe-task-definition --task-definition ${{ vars.MIGRATE_TASK_FAMILY }} \
            --query taskDefinition > td.json
          jq --arg img "$IMAGE" '.containerDefinitions[0].image=$img
            | del(.taskDefinitionArn,.revision,.status,.requiresAttributes,.compatibilities,.registeredAt,.registeredBy)' \
            td.json > td-new.json
          TD_ARN=$(aws ecs register-task-definition --cli-input-json file://td-new.json \
            --query taskDefinition.taskDefinitionArn --output text)
          TASK=$(aws ecs run-task --cluster ${{ vars.ECS_CLUSTER }} --launch-type FARGATE --task-definition $TD_ARN \
            --network-configuration "awsvpcConfiguration={subnets=[${{ vars.MIGRATE_SUBNET }}],securityGroups=[${{ vars.MIGRATE_SG }}],assignPublicIp=ENABLED}" \
            --query 'tasks[0].taskArn' --output text)
          aws ecs wait tasks-stopped --cluster ${{ vars.ECS_CLUSTER }} --tasks $TASK
          CODE=$(aws ecs describe-tasks --cluster ${{ vars.ECS_CLUSTER }} --tasks $TASK \
            --query 'tasks[0].containers[0].exitCode' --output text)
          test "$CODE" = "0" || { echo "Migration failed (exit $CODE)"; exit 1; }

      - name: Deploy Lambda
        run: |
          aws lambda update-function-code --function-name ${{ vars.LAMBDA_FUNCTION }} --image-uri $IMAGE
          aws lambda wait function-updated-v2 --function-name ${{ vars.LAMBDA_FUNCTION }}
          VERSION=$(aws lambda publish-version --function-name ${{ vars.LAMBDA_FUNCTION }} --query Version --output text)
          aws lambda update-alias --function-name ${{ vars.LAMBDA_FUNCTION }} --name live --function-version $VERSION

      - name: Deploy frontend
        run: |
          cd frontend && npm ci && npm run build
          aws s3 sync dist/assets s3://${{ vars.WEB_BUCKET }}/assets --cache-control "public,max-age=31536000,immutable"
          aws s3 sync dist s3://${{ vars.WEB_BUCKET }} --delete --exclude "assets/*" --cache-control "no-cache"
          aws cloudfront create-invalidation --distribution-id ${{ vars.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/index.html" "/"

      - name: Smoke test
        run: curl --fail --retry 5 --retry-delay 5 ${{ vars.APP_URL }}/api/health
```
Notes:
- Pin actions to their current major versions (or commit SHAs) and update them periodically.
- The frontend `assets/` sync does **not** use `--delete`, so users with an old `index.html` still load their old hashed files during the rollout. Prune old assets occasionally.
- `concurrency` prevents two deploys from running migrations at the same time.

### Release order and migration safety
1. Tests pass.
2. New image pushed.
3. **Migrations run while the old Lambda version still serves traffic.** Every migration must therefore be backward compatible with the previous code (expand/contract): add nullable columns or new tables first; remove or rename columns only in a later release after the code stops using them.
4. Lambda alias `live` moves to the new version (instant switch).
5. Frontend uploaded and `index.html` invalidated.
6. Smoke test.

Before tagging a release, run the PostgreSQL release check locally ([local_deployment.md](local_deployment.md), section 9, step 4).

## 8. Post-deployment verification

1. `https://<app-url>/api/health` returns `{"status": "ok"}`.
2. `https://<app-url>` loads the login page over HTTPS; `http://` redirects to HTTPS.
3. Register, log in, add a personal expense, create a family, invite a second account, accept, add a family expense; both users see it; personal expenses stay private.
4. Reload `https://<app-url>/reports`: the app loads (SPA rewrite works).
5. `https://<app-url>/api/does-not-exist` returns a JSON 404, **not** `index.html`.
6. `https://<app-url>/docs` returns 404 (docs disabled in production).
7. Browser dev tools: the refresh cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, path `/api/auth`.
8. Response headers include `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`.
9. Wait more than 10 minutes, then use the app: the access token is refreshed silently.
10. S3 object URL `https://<bucket>.s3.<region>.amazonaws.com/index.html` returns **AccessDenied** (bucket is private).
11. RDS has no public endpoint access (connection from your laptop times out).
12. CloudWatch: Lambda logs show requests and no errors; all alarms are in **OK** state.

## 9. Rollback

| What | How |
|---|---|
| Backend code | `aws lambda update-alias --function-name expense-sarathi-api --name live --function-version <previous>` (instant). Find versions with `aws lambda list-versions-by-function`. |
| Frontend | Re-run `deploy.yml` with **workflow_dispatch** on the previous commit, or restore the previous `index.html` version from S3 versioning and invalidate `/index.html`. |
| Database schema | Prefer a forward fix. Only if necessary, run the migration task with command `alembic downgrade -1`. |
| Database data | RDS point-in-time restore to a new instance (within the 7-day window), then switch `DB_HOST` to it. |

## 10. Operations

- **Secrets rotation**: update `jwt_secret` or `db_password` in the secret (and the RDS master password with `aws rds modify-db-instance --master-user-password`), then publish a new Lambda version so new cold starts read the new values. Rotating `jwt_secret` logs everyone out.
- **Logs**: `aws logs tail /aws/lambda/expense-sarathi-api --follow`.
- **Database access for debugging**: none by default. If needed, run a temporary ECS task (same image, `python` shell) in the VPC, or add a temporary bastion; remove it afterwards.
- **Patching**: RDS minor versions upgrade automatically in the maintenance window. Rebuild the image regularly to pick up Python base image fixes; check ECR scan findings.
- **Costs to watch**: RDS instance and storage, the Secrets Manager VPC endpoint (billed per AZ per hour), CloudFront data transfer, and Fargate minutes for migrations. There is no NAT gateway.

## 11. Teardown

Delete in reverse order of creation. RDS deletion protection must be turned off first, and take a final snapshot if the data matters.

1. GitHub: disable the `deploy` workflow; delete the `production` environment variables.
2. CloudFront: disable the distribution, wait until deployed, delete it; delete the function, response headers policy and OAC.
3. S3: empty the bucket (including all versions), then delete it.
4. API Gateway: delete the API.
5. Lambda: delete the function (versions and alias go with it).
6. ECS: delete the task definitions (deregister) and the cluster.
7. RDS: modify to disable deletion protection, delete with a final snapshot, delete the subnet group.
8. Secrets Manager: delete the secret (7-30 day recovery window).
9. VPC endpoint, security groups, subnets, route table, internet gateway, VPC.
10. ECR repository (with `--force` to delete images).
11. IAM roles, inline policies, OIDC provider; SNS topic; CloudWatch alarms and log groups.

With Terraform: set `deletion_protection = false`, apply, then `terraform destroy`, and finally delete the state bucket.
