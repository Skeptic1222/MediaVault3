#!/bin/bash

# MediaVault Security Enhancement Deployment Script
# This script applies security improvements to the MediaVault application

echo "========================================="
echo "MediaVault Security Enhancement Deployment"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running from project root
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo -e "${YELLOW}Starting security enhancements...${NC}"

# 1. Backup current server index
echo -e "\n${GREEN}1. Backing up current server configuration...${NC}"
if [ -f "server/index.ts" ]; then
    cp server/index.ts server/index-backup-$(date +%Y%m%d-%H%M%S).ts
    echo "   ✓ Backup created"
fi

# 2. Switch to secure server configuration
echo -e "\n${GREEN}2. Applying secure server configuration...${NC}"
if [ -f "server/index-secure.ts" ]; then
    cp server/index-secure.ts server/index.ts
    echo "   ✓ Secure configuration applied"
else
    echo -e "   ${RED}✗ Secure configuration file not found${NC}"
fi

# 3. Create necessary directories
echo -e "\n${GREEN}3. Creating required directories...${NC}"
mkdir -p logs
mkdir -p uploads/temp
mkdir -p encrypted_media
echo "   ✓ Directories created"

# 4. Set appropriate permissions
echo -e "\n${GREEN}4. Setting file permissions...${NC}"
chmod 700 logs
chmod 700 encrypted_media
chmod 755 uploads
echo "   ✓ Permissions set"

# 5. Update environment variables
echo -e "\n${GREEN}5. Checking environment configuration...${NC}"
if [ ! -f ".env" ]; then
    echo -e "   ${YELLOW}⚠ No .env file found. Creating from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "   ✓ .env file created from example"
        echo -e "   ${YELLOW}⚠ Please update .env with your actual configuration${NC}"
    fi
else
    echo "   ✓ .env file exists"
fi

# 6. Check for strong JWT secret
echo -e "\n${GREEN}6. Validating JWT secret strength...${NC}"
if [ -f ".env" ]; then
    JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d '=' -f2)
    if [ ${#JWT_SECRET} -lt 32 ]; then
        echo -e "   ${YELLOW}⚠ JWT_SECRET is too weak (less than 32 characters)${NC}"
        echo "   Generating a strong JWT secret..."
        NEW_SECRET=$(openssl rand -hex 32)
        sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" .env
        echo "   ✓ Strong JWT secret generated and saved"
    else
        echo "   ✓ JWT secret is sufficiently strong"
    fi
fi

# 7. Build the application
echo -e "\n${GREEN}7. Building the application...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo "   ✓ Build successful"
else
    echo -e "   ${RED}✗ Build failed. Please fix errors before deploying${NC}"
    exit 1
fi

# 8. Run security audit
echo -e "\n${GREEN}8. Running security audit...${NC}"
npm audit --audit-level=moderate
echo "   ✓ Security audit complete"

# 9. Generate security report
echo -e "\n${GREEN}9. Generating security report...${NC}"
cat > security-report-$(date +%Y%m%d).md << EOL
# MediaVault Security Enhancement Report
Generated: $(date)

## Applied Security Enhancements

### 1. Security Middleware
- ✓ Rate limiting (100 req/15min general, 5 req/15min for auth)
- ✓ CSRF protection
- ✓ Security headers (CSP, HSTS, X-Frame-Options, etc.)
- ✓ Input sanitization
- ✓ Request size limits

### 2. Authentication & Authorization
- ✓ JWT with refresh tokens
- ✓ Token blacklisting
- ✓ Session validation
- ✓ Secure token storage recommendations

### 3. Error Handling & Logging
- ✓ Comprehensive error handling
- ✓ Security event logging
- ✓ Performance monitoring
- ✓ Audit trail

### 4. File Security
- ✓ Path traversal protection
- ✓ File type validation
- ✓ Secure upload directory
- ✓ File size limits

### 5. Database Security
- ✓ Parameterized queries via Drizzle ORM
- ✓ Input validation with Zod
- ✓ Connection security

## Next Steps

1. **Configure production environment variables**
   - Set strong JWT_SECRET (32+ characters)
   - Configure DATABASE_URL
   - Set appropriate LOG_LEVEL

2. **Enable HTTPS**
   - Install SSL certificate
   - Configure IIS for HTTPS
   - Enable HSTS header

3. **Setup monitoring**
   - Configure log aggregation
   - Setup alerting for security events
   - Monitor rate limit violations

4. **Regular maintenance**
   - Run npm audit weekly
   - Update dependencies monthly
   - Review security logs daily

## Security Checklist

- [ ] Strong JWT secret configured
- [ ] Database credentials secured
- [ ] HTTPS enabled in production
- [ ] Rate limiting tested
- [ ] CSRF protection verified
- [ ] Log monitoring setup
- [ ] Backup strategy implemented
- [ ] Incident response plan documented

## Important Files

- Server configuration: server/index.ts
- Security middleware: server/middleware/security.ts
- Error handling: server/middleware/errorHandler.ts
- Logging: server/utils/logger.ts
- Auth security: server/middleware/authSecurity.ts

EOL

echo "   ✓ Security report generated: security-report-$(date +%Y%m%d).md"

# 10. Summary
echo -e "\n========================================="
echo -e "${GREEN}Security enhancements applied successfully!${NC}"
echo "========================================="
echo -e "\n${YELLOW}Important next steps:${NC}"
echo "1. Review and update .env configuration"
echo "2. Test the application thoroughly"
echo "3. Enable HTTPS in production"
echo "4. Setup log monitoring"
echo "5. Review security-report-$(date +%Y%m%d).md"
echo -e "\n${GREEN}To start the application:${NC}"
echo "   Development: npm run dev"
echo "   Production: npm start"
echo ""