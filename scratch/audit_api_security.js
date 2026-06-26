const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '../src/app/api');

function getRouteFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getRouteFiles(filePath, fileList);
    } else if (file === 'route.ts' || file === 'route.js') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const routeFiles = getRouteFiles(apiDir);
console.log(`Found ${routeFiles.length} route files.\n`);

const results = [];

for (const file of routeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const relativePath = path.relative(path.join(__dirname, '..'), file);
  
  // Find which HTTP methods are exported
  const methods = [];
  if (content.includes('export async function GET')) methods.push('GET');
  if (content.includes('export async function POST')) methods.push('POST');
  if (content.includes('export async function PUT')) methods.push('PUT');
  if (content.includes('export async function DELETE')) methods.push('DELETE');
  if (content.includes('export async function PATCH')) methods.push('PATCH');

  // Check how authorization is done
  const hasCookiesCheck = content.includes('cookies()') || content.includes('cookieStore');
  const hasAuthtokenCheck = content.includes('authtoken') || content.includes('token');
  const hasSessionCheck = content.includes('session') || content.includes('getSession');
  const hasSuperAdminCheck = content.includes('issuperadmin') || content.includes('SuperAdmin');
  const hasAdminCheck = content.includes('isadmin') || content.includes('Admin');

  results.push({
    file: relativePath,
    methods,
    hasCookiesCheck,
    hasAuthtokenCheck,
    hasSessionCheck,
    hasSuperAdminCheck,
    hasAdminCheck,
  });
}

console.log(JSON.stringify(results, null, 2));
