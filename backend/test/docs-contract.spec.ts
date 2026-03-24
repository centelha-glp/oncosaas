import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

type DecoratorInfo = {
  name: string;
  text: string;
};

const SRC_ROOT = path.resolve(__dirname, '../src');
const ROUTE_DECORATORS = new Set([
  'Get',
  'Post',
  'Put',
  'Patch',
  'Delete',
  'Head',
  'Options',
  'All',
]);
const SERVICE_WRITE_METHODS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

const CONTROLLER_GUARD_EXEMPTIONS = new Set([
  'app.controller.ts',
  'auth.controller.ts',
  'channel-gateway.controller.ts',
  'whatsapp-connections.controller.ts',
]);

const TENANT_WHERE_CHECK_EXEMPTIONS = new Set([
  'app.service.ts',
  'auth.service.ts',
  'prisma.service.ts',
  'redis.service.ts',
  'fhir-config.service.ts',
]);

function listFilesBySuffix(suffix: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && fullPath.endsWith(suffix) && !fullPath.endsWith('.spec.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(SRC_ROOT);
  return files.sort((a, b) => a.localeCompare(b));
}

function getSourceFile(filePath: string): ts.SourceFile {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function findExportedClass(sourceFile: ts.SourceFile): ts.ClassDeclaration | undefined {
  return sourceFile.statements.find(
    (stmt): stmt is ts.ClassDeclaration =>
      ts.isClassDeclaration(stmt) &&
      !!stmt.name &&
      !!stmt.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function getDecorators(node: ts.Node, sourceFile: ts.SourceFile): DecoratorInfo[] {
  const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];

  return decorators
    .map((decorator): DecoratorInfo | null => {
      const expression = decorator.expression;

      if (ts.isCallExpression(expression)) {
        const callee = expression.expression;
        const name = ts.isIdentifier(callee) ? callee.text : callee.getText(sourceFile);
        return { name, text: expression.getText(sourceFile) };
      }

      if (ts.isIdentifier(expression)) {
        return { name: expression.text, text: expression.getText(sourceFile) };
      }

      return null;
    })
    .filter((item): item is DecoratorInfo => item !== null);
}

function hasGuardTextWith(guardDecoratorText: string | undefined, ...guards: string[]): boolean {
  if (!guardDecoratorText) {
    return false;
  }

  return guards.every((guard) => guardDecoratorText.includes(guard));
}

function extractCallTextFromNode(node: ts.CallExpression, sourceFile: ts.SourceFile): string {
  return node.getText(sourceFile);
}

function whereObjectHasTenantId(node: ts.Expression | undefined): boolean {
  if (!node || !ts.isObjectLiteralExpression(node)) {
    return false;
  }

  const stack: ts.ObjectLiteralExpression[] = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const property of current.properties) {
      if (ts.isPropertyAssignment(property)) {
        const name = property.name.getText();
        if (name === 'tenantId') {
          return true;
        }

        if (ts.isObjectLiteralExpression(property.initializer)) {
          stack.push(property.initializer);
        }
      }

      if (ts.isShorthandPropertyAssignment(property) && property.name.getText() === 'tenantId') {
        return true;
      }
    }
  }

  return false;
}

function findObjectProperty(
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string
): ts.PropertyAssignment | undefined {
  for (const property of objectLiteral.properties) {
    if (ts.isPropertyAssignment(property) && property.name.getText() === propertyName) {
      return property;
    }
  }

  return undefined;
}

describe('Documentation-driven Controller Contracts', () => {
  const controllerFiles = listFilesBySuffix('.controller.ts');

  it('covers every controller file in src/', () => {
    expect(controllerFiles.length).toBeGreaterThan(0);
  });

  describe.each(controllerFiles)('%s', (filePath) => {
    const fileName = path.basename(filePath);
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = getSourceFile(filePath);
    const controllerClass = findExportedClass(sourceFile);

    it('is declared as a Nest controller (@Controller)', () => {
      expect(controllerClass).toBeDefined();
      const decorators = getDecorators(controllerClass as ts.ClassDeclaration, sourceFile);
      expect(decorators.some((decorator) => decorator.name === 'Controller')).toBe(true);
    });

    it('does not access process.env directly in controller code', () => {
      expect(sourceText).not.toMatch(/process\.env\./);
    });

    it('does not use console.log in controller code', () => {
      expect(sourceText).not.toMatch(/console\.log\(/);
    });

    it('has explicit auth posture for each route handler (public or guarded)', () => {
      expect(controllerClass).toBeDefined();
      const classNode = controllerClass as ts.ClassDeclaration;

      const classDecorators = getDecorators(classNode, sourceFile);
      const classGuardDecoratorText = classDecorators.find((d) => d.name === 'UseGuards')?.text;
      const classIsGuarded = hasGuardTextWith(classGuardDecoratorText, 'JwtAuthGuard', 'TenantGuard');

      const missingProtection: string[] = [];

      for (const member of classNode.members) {
        if (!ts.isMethodDeclaration(member) || !member.name) {
          continue;
        }

        const methodDecorators = getDecorators(member, sourceFile);
        const isRouteMethod = methodDecorators.some((decorator) => ROUTE_DECORATORS.has(decorator.name));
        if (!isRouteMethod) {
          continue;
        }

        const isPublicMethod = methodDecorators.some((decorator) => decorator.name === 'Public');
        if (isPublicMethod) {
          continue;
        }

        const methodGuardDecoratorText = methodDecorators.find((d) => d.name === 'UseGuards')?.text;
        const methodIsGuarded = hasGuardTextWith(methodGuardDecoratorText, 'JwtAuthGuard', 'TenantGuard');

        if (!classIsGuarded && !methodIsGuarded && !CONTROLLER_GUARD_EXEMPTIONS.has(fileName)) {
          missingProtection.push(member.name.getText(sourceFile));
        }

        const hasRolesDecorator = methodDecorators.some((decorator) => decorator.name === 'Roles');
        if (hasRolesDecorator) {
          const classHasRolesGuard = classGuardDecoratorText?.includes('RolesGuard') ?? false;
          const methodHasRolesGuard = methodGuardDecoratorText?.includes('RolesGuard') ?? false;

          if (!classHasRolesGuard && !methodHasRolesGuard) {
            missingProtection.push(`${member.name.getText(sourceFile)} (missing RolesGuard)`);
          }
        }
      }

      expect(missingProtection).toEqual([]);
    });

    it('uses ParseUUIDPipe for id-like @Param fields', () => {
      expect(controllerClass).toBeDefined();
      const classNode = controllerClass as ts.ClassDeclaration;
      const invalidParams: string[] = [];

      for (const member of classNode.members) {
        if (!ts.isMethodDeclaration(member) || !member.name) {
          continue;
        }

        const methodName = member.name.getText(sourceFile);
        for (const parameter of member.parameters) {
          const parameterDecorators = getDecorators(parameter, sourceFile);
          const paramDecorator = parameterDecorators.find((decorator) => decorator.name === 'Param');

          if (!paramDecorator) {
            continue;
          }

          const paramMatch = paramDecorator.text.match(/@Param\(\s*['"]([^'"]+)['"]/);
          if (!paramMatch) {
            continue;
          }

          const paramName = paramMatch[1];
          const isIdLike = /(^id$|id$)/i.test(paramName);
          if (!isIdLike) {
            continue;
          }

          if (!paramDecorator.text.includes('ParseUUIDPipe')) {
            invalidParams.push(`${methodName}:${paramName}`);
          }
        }
      }

      expect(invalidParams).toEqual([]);
    });
  });
});

describe('Documentation-driven Service Contracts', () => {
  const serviceFiles = listFilesBySuffix('.service.ts');

  it('covers every service file in src/', () => {
    expect(serviceFiles.length).toBeGreaterThan(0);
  });

  describe.each(serviceFiles)('%s', (filePath) => {
    const fileName = path.basename(filePath);
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = getSourceFile(filePath);
    const serviceClass = findExportedClass(sourceFile);

    it('is declared as an injectable Nest service (@Injectable)', () => {
      expect(serviceClass).toBeDefined();
      const decorators = getDecorators(serviceClass as ts.ClassDeclaration, sourceFile);
      expect(decorators.some((decorator) => decorator.name === 'Injectable')).toBe(true);
    });

    it('does not use console.log in service code', () => {
      expect(sourceText).not.toMatch(/console\.log\(/);
    });

    it('does not use raw unsafe Prisma SQL methods', () => {
      expect(sourceText).not.toMatch(/\$queryRawUnsafe\s*\(/);
      expect(sourceText).not.toMatch(/\$executeRawUnsafe\s*\(/);
    });

    it('enforces tenantId in Prisma write where clauses (doc security invariant)', () => {
      if (TENANT_WHERE_CHECK_EXEMPTIONS.has(fileName)) {
        expect(true).toBe(true);
        return;
      }

      const violations: string[] = [];

      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const methodName = node.expression.name.text;

          if (SERVICE_WRITE_METHODS.has(methodName)) {
            const callText = extractCallTextFromNode(node, sourceFile);
            const hasPrismaPattern = /\.prisma\./.test(callText) || /\btx\./.test(callText);

            if (hasPrismaPattern) {
              const [firstArg] = node.arguments;
              if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
                const whereProperty = findObjectProperty(firstArg, 'where');

                if (whereProperty) {
                  const hasTenantId = whereObjectHasTenantId(whereProperty.initializer);
                  if (!hasTenantId) {
                    violations.push(`${methodName} at ${sourceFile.fileName}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
                  }
                }
              }
            }
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
      expect(violations).toEqual([]);
    });
  });
});

describe('FHIR Documentation Contracts', () => {
  const fhirControllerPath = path.join(SRC_ROOT, 'integrations/fhir/fhir.controller.ts');
  const fhirReadmePath = path.join(SRC_ROOT, 'integrations/fhir/README.md');

  it('documents and exposes the manual sync endpoints described in README', () => {
    const readme = fs.readFileSync(fhirReadmePath, 'utf8');
    const controller = fs.readFileSync(fhirControllerPath, 'utf8');

    expect(readme).toContain('POST /api/v1/fhir/observations/:id/sync');
    expect(readme).toContain('POST /api/v1/fhir/patients/:id/sync');
    expect(readme).toContain('POST /api/v1/fhir/observations/sync-all');
    expect(readme).toContain('POST /api/v1/fhir/patients/:id/pull');

    expect(controller).toContain("@Post('observations/:id/sync')");
    expect(controller).toContain("@Post('patients/:id/sync')");
    expect(controller).toContain("@Post('observations/sync-all')");
    expect(controller).toContain("@Post('patients/:id/pull')");
  });
});
