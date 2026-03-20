/**
 * Servidor HTTPS customizado para Next.js em desenvolvimento
 * Usa certificados SSL autoassinados gerados pelo script generate-ssl-certs.js
 */

const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = 3000;

// Caminhos dos certificados
const certDir = path.join(__dirname, '..', 'certs');
const keyPath = path.join(certDir, 'localhost.key');
const certPath = path.join(certDir, 'localhost.crt');

// Verificar se os certificados existem
if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error('❌ Certificados SSL não encontrados!');
  console.error(`   Esperado em: ${certDir}`);
  console.error('\n📋 Execute primeiro:');
  console.error('   npm run generate-certs');
  console.error('\n   Ou manualmente:');
  console.error('   node scripts/generate-ssl-certs.js');
  process.exit(1);
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };

  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 Frontend running on https://${hostname}:${port}`);
    console.log('⚠️  Certifique-se de que o certificado está instalado como confiável!');
  });
});

