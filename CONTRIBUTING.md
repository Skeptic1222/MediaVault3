# Contributing to MediaVault

Thank you for your interest in contributing to MediaVault! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git

### Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd MediaVault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup database**
   ```bash
   npm run db:setup
   npm run db:push
   ```

4. **Configure environment**
   - Copy `.env.example` to `.env`
   - Update credentials and configuration

5. **Start development server**
   ```bash
   npm run start:dev
   ```

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - New features
- `fix/*` - Bug fixes
- `security/*` - Security improvements

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, maintainable code
   - Follow existing code style
   - Add tests for new functionality

3. **Run tests**
   ```bash
   npm run check          # TypeScript type checking
   npm run test:unit      # Unit tests
   npm run test:e2e       # E2E tests
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions or changes
- `chore:` - Build process or auxiliary tool changes
- `security:` - Security improvements

**Examples:**
```
feat: add video thumbnail generation
fix: resolve authentication timeout issue
security: implement CSP headers
perf: optimize database queries with indexes
```

## Code Standards

### TypeScript
- Enable strict mode
- No `any` types (use `unknown` if necessary)
- Proper error handling with try-catch
- Document complex logic with comments

### React Components
- Use functional components with hooks
- Implement proper prop types
- Use `React.memo` for expensive components
- Keep components small and focused

### Backend
- Validate all inputs with Zod schemas
- Sanitize user input
- Use proper error responses
- Log errors appropriately

### Security
- Never commit credentials or secrets
- Validate file uploads thoroughly
- Use parameterized queries
- Follow OWASP guidelines

## Testing

### Unit Tests
- Test individual functions and utilities
- Mock external dependencies
- Aim for 80%+ code coverage

### E2E Tests
- Test critical user workflows
- Use Playwright for browser automation
- Test on multiple viewports

### Running Tests
```bash
# Unit tests
npm run test:unit

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage

# Interactive mode
npm run test:e2e:ui
```

## Pull Request Process

1. **Before submitting:**
   - Update documentation if needed
   - Add tests for new features
   - Ensure all tests pass
   - Run type checking: `npm run check`

2. **Create Pull Request:**
   - Use descriptive title
   - Reference related issues
   - Provide detailed description
   - Include screenshots for UI changes

3. **PR Template:**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Unit tests added/updated
   - [ ] E2E tests added/updated
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows project standards
   - [ ] Tests pass locally
   - [ ] Documentation updated
   - [ ] No security vulnerabilities introduced
   ```

4. **Review Process:**
   - Address reviewer feedback
   - Keep PR focused and small
   - Rebase on main if needed

## Security Vulnerabilities

**DO NOT** open public issues for security vulnerabilities.

Instead, please report security issues privately:
1. Email security details to [security contact]
2. Include steps to reproduce
3. Provide potential impact assessment

## Questions or Issues?

- Check [README.md](./README.md) for common issues
- Review [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design
- Open a GitHub issue for bugs or feature requests
- Join our community discussions

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what's best for the project
- Welcome newcomers and help them learn

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
